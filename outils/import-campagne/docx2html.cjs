/**
 * Convertit un `word/document.xml` (extrait d'un .docx) en HTML compatible TipTap.
 * Sous-ensemble : titres, paragraphes, listes, tableaux, gras/italique/souligné, sauts de ligne.
 */
const { readFileSync } = require('node:fs')

/** Le XML porte déjà ses entités : on décode avant de ré-échapper pour le HTML. */
const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

const esc = (s) =>
  decode(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Découpe le XML en un arbre très simple (suffisant pour du WordprocessingML). */
function parse(xml) {
  const root = { name: '#root', attrs: {}, children: [] }
  const stack = [root]
  const re = /<([^!?][^>]*?)(\/?)>|([^<]+)/g
  let m
  while ((m = re.exec(xml))) {
    if (m[3] !== undefined) {
      const text = m[3]
      if (text) stack[stack.length - 1].children.push({ name: '#text', text })
      continue
    }
    const raw = m[1]
    const selfClose = m[2] === '/'
    if (raw.startsWith('/')) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const name = raw.split(/[\s/>]/)[0]
    const attrs = {}
    for (const a of raw.matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
    const node = { name, attrs, children: [] }
    stack[stack.length - 1].children.push(node)
    if (!selfClose) stack.push(node)
  }
  return root
}

const find = (node, name) => node.children.filter((c) => c.name === name)
const first = (node, name) => node.children.find((c) => c.name === name)

function deep(node, name, acc = []) {
  for (const c of node.children ?? []) {
    if (c.name === name) acc.push(c)
    deep(c, name, acc)
  }
  return acc
}

/** Texte d'un run, avec ses marques. */
function runHtml(r) {
  let out = ''
  for (const c of r.children) {
    if (c.name === 'w:t') {
      const t = c.children.map((x) => x.text ?? '').join('')
      out += esc(t)
    } else if (c.name === 'w:br') out += '<br>'
    else if (c.name === 'w:tab') out += ' '
  }
  if (!out) return ''
  const pr = first(r, 'w:rPr')
  if (pr) {
    const on = (n) => {
      const e = first(pr, n)
      return e && e.attrs['w:val'] !== '0' && e.attrs['w:val'] !== 'false' && e.attrs['w:val'] !== 'none'
    }
    if (on('w:b')) out = `<strong>${out}</strong>`
    if (on('w:i')) out = `<em>${out}</em>`
    if (on('w:u')) out = `<u>${out}</u>`
  }
  return out
}

function paraParts(p) {
  const pr = first(p, 'w:pPr')
  const style = pr && first(pr, 'w:pStyle')?.attrs['w:val']
  const numPr = pr && first(pr, 'w:numPr')
  const jc = pr && first(pr, 'w:jc')?.attrs['w:val']
  let inner = ''
  for (const c of p.children) {
    if (c.name === 'w:r') inner += runHtml(c)
    else if (c.name === 'w:hyperlink') for (const r of find(c, 'w:r')) inner += runHtml(r)
    else if (c.name === 'w:ins') for (const r of deep(c, 'w:r')) inner += runHtml(r)
  }
  return { style: style ?? '', list: !!numPr, align: jc, inner: inner.trim() }
}

function headingLevel(style) {
  const m = /^(?:Heading|Titre)(\d)$/i.exec(style)
  if (m) return Math.min(3, Number(m[1]))
  if (/^(Title|Titre)$/i.test(style)) return 1
  if (/^(Subtitle|Sous-titre)$/i.test(style)) return 3
  return 0
}

function tableHtml(tbl) {
  let rows = ''
  for (const tr of find(tbl, 'w:tr')) {
    let cells = ''
    for (const tc of find(tr, 'w:tc')) {
      const paras = find(tc, 'w:p').map((p) => paraParts(p).inner).filter(Boolean)
      cells += `<td><p>${paras.join('</p><p>') || ''}</p></td>`
    }
    rows += `<tr>${cells}</tr>`
  }
  return `<table>${rows}</table>`
}

function docxToHtml(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8')
  const doc = parse(xml)
  const body = deep(doc, 'w:body')[0]
  if (!body) return ''

  const out = []
  let list = null // 'ul' en cours
  const closeList = () => {
    if (list) {
      out.push('</ul>')
      list = null
    }
  }

  for (const node of body.children) {
    if (node.name === 'w:p') {
      const { style, list: isList, align, inner: raw } = paraParts(node)
      // Un paragraphe qui ne porte que des sauts de ligne est du vide déguisé.
      const inner = raw.replace(/^(?:<br>|\s)+/, '').replace(/(?:<br>|\s)+$/, '')
      if (!inner) {
        closeList()
        continue
      }
      if (isList) {
        if (!list) {
          out.push('<ul>')
          list = 'ul'
        }
        out.push(`<li><p>${inner}</p></li>`)
        continue
      }
      closeList()
      const h = headingLevel(style)
      if (h) out.push(`<h${h}>${inner}</h${h}>`)
      else if (/quote/i.test(style)) out.push(`<blockquote><p>${inner}</p></blockquote>`)
      else {
        const a = align === 'center' || align === 'right' ? ` style="text-align: ${align}"` : ''
        out.push(`<p${a}>${inner}</p>`)
      }
    } else if (node.name === 'w:tbl') {
      closeList()
      out.push(tableHtml(node))
    }
  }
  closeList()
  return out.join('\n')
}

module.exports = { docxToHtml }
