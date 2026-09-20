/**
 * Convertit les documents Word d'un dossier de campagne en documents lisibles
 * par Écran du Maître.
 *
 * Depuis que le dossier fait foi, l'application n'a plus besoin qu'on lui
 * importe quoi que ce soit : elle lit le dossier tel qu'il est. Il reste une
 * chose qu'elle ne sait pas lire, c'est le `.docx`. Cet outil le traduit en
 * `.html` — titres, listes, tableaux, gras et italiques — et dépose le résultat
 * dans un sous-dossier `Documents`, à côté des originaux, qui ne sont jamais
 * modifiés.
 *
 *   node outils/import-campagne/documents-word.cjs "D:\\chemin\\de\\la\\campagne"
 *
 * Aucune base n'est touchée : au prochain examen du dossier, l'application
 * découvre les fichiers et les range toute seule.
 */
const { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } = require('node:fs')
const { basename, extname, join } = require('node:path')
const { execFileSync } = require('node:child_process')
const { tmpdir } = require('node:os')
const { docxToHtml } = require(join(__dirname, 'docx2html.cjs'))

const SRC = process.argv[2]
if (!SRC || !existsSync(SRC)) {
  console.error('Usage : node documents-word.cjs "<dossier de la campagne>"')
  process.exit(1)
}

/** Un .docx est un zip : le `tar.exe` livré avec Windows sait en extraire une entrée. */
const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
const work = mkdtempSync(join(tmpdir(), 'edm-docx-'))
let n = 0

function* wordFiles(dir, depth = 0) {
  if (depth > 8) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('~$')) continue
    const abs = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'Documents') continue // déjà converti
      yield* wordFiles(abs, depth + 1)
    } else if (extname(e.name).toLowerCase() === '.docx') {
      yield abs
    }
  }
}

const out = join(SRC, 'Documents')
mkdirSync(out, { recursive: true })

for (const abs of wordFiles(SRC)) {
  const name = basename(abs, '.docx')
  const dest = join(out, `${name}.html`)
  if (existsSync(dest)) {
    console.log(`  = ${name} (déjà là)`)
    continue
  }
  const box = join(work, String(n))
  mkdirSync(box, { recursive: true })
  try {
    execFileSync(TAR, ['-xf', abs, 'word/document.xml'], { cwd: box })
    const html = docxToHtml(join(box, 'word', 'document.xml'))
    if (!html.trim()) {
      console.log(`  ~ ${name} : aucun texte (images seules ?), ignoré`)
      continue
    }
    writeFileSync(dest, html, 'utf8')
    console.log(`  + ${name}.html`)
    n++
  } catch (e) {
    console.error(`  ! ${name} : ${e instanceof Error ? e.message : e}`)
  }
}

rmSync(work, { recursive: true, force: true })
console.log(`\n${n} document(s) écrits dans ${out}`)
