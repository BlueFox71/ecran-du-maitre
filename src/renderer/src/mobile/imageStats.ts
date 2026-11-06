/**
 * Les statistiques de la séance en image, dessinées sur le téléphone.
 *
 * Le MJ les a révélées à l'écran, puis laissées emporter (« Enregistrables
 * par les joueurs ») : chaque joueur peut garder celle du groupe et la sienne,
 * pour la poster dans la discussion de la table. Tout est dessiné à la main
 * sur une toile — pas de capture d'écran : le téléphone n'a pas la page du MJ,
 * et l'image doit avoir la même allure sur tous les appareils.
 *
 * Les portraits viennent du poste du MJ : sur une autre origine (en
 * développement), la toile serait « salie » et refuserait de s'exporter. On
 * ne les charge donc qu'en lecture croisée, et un portrait qui ne vient pas
 * laisse la place à l'initiale dans la couleur du joueur.
 */
import { PION_COULEURS, type StatsEcran, type VisageStats } from '@shared/types'

const L = 1080
const MARGE = 64
const FOND = '#0f1518'
const CARTE = '#161f23'
const TRAIT = '#2a373d'
const TEXTE = '#f2ece0'
const PALE = '#9aa7ab'
const TERNE = '#6b7b80'
const LAITON = '#d8a94a'
const SANG = '#c0564d'
const POLICE = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = 'ui-monospace, Menlo, Consolas, monospace'

type Joueur = StatsEcran['joueurs'][number]

const hexDe = (cle: string): string =>
  PION_COULEURS.find((c) => c.key === cle.replace(/^c-/, ''))?.hex ?? '#6b7b80'

const virgule = (x: number, d = 1): string => x.toFixed(d).replace('.', ',')

/** Charger une image en lecture croisée ; `null` si elle ne vient pas. */
function charger(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((ok) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = () => ok(null)
    img.src = url
  })
}

/** Les portraits de tous ceux qu'on dessinera, chargés une fois. */
async function portraits(visages: VisageStats[]): Promise<Map<string, HTMLImageElement>> {
  const m = new Map<string, HTMLImageElement>()
  await Promise.all(
    visages.map(async (v) => {
      const img = await charger(v.url)
      if (img) m.set(v.nom, img)
    })
  )
  return m
}

/** Une toile de la bonne hauteur : on dessine deux fois — d'abord pour mesurer. */
function toile(h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = L
  c.height = Math.ceil(h)
  const x = c.getContext('2d')!
  x.fillStyle = FOND
  x.fillRect(0, 0, c.width, c.height)
  x.textBaseline = 'alphabetic'
  return { c, x }
}

function police(x: CanvasRenderingContext2D, taille: number, poids = 400, famille = POLICE): void {
  x.font = `${poids} ${taille}px ${famille}`
}

/** Un texte qui ne dépasse pas sa largeur : coupé d'une ellipse. */
function ecrire(x: CanvasRenderingContext2D, t: string, px: number, py: number, max: number): void {
  let s = t
  if (x.measureText(s).width > max) {
    while (s.length > 1 && x.measureText(s + '…').width > max) s = s.slice(0, -1)
    s += '…'
  }
  x.fillText(s, px, py)
}

function rect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number): void {
  x.beginPath()
  x.roundRect(px, py, w, h, r)
}

/** Le portrait rond, ou l'initiale sur la couleur du joueur. */
function visage(
  x: CanvasRenderingContext2D,
  v: VisageStats,
  img: HTMLImageElement | undefined,
  cx: number,
  cy: number,
  r: number
): void {
  x.save()
  x.beginPath()
  x.arc(cx, cy, r, 0, Math.PI * 2)
  x.closePath()
  if (img) {
    x.clip()
    const k = Math.max((2 * r) / img.width, (2 * r) / img.height)
    const w = img.width * k
    const h = img.height * k
    x.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  } else {
    x.fillStyle = hexDe(v.color)
    x.fill()
    x.fillStyle = '#fff'
    police(x, r * 0.95, 700)
    x.textAlign = 'center'
    x.fillText((v.nom.trim()[0] ?? '?').toUpperCase(), cx, cy + r * 0.34)
    x.textAlign = 'left'
  }
  x.restore()
  x.beginPath()
  x.arc(cx, cy, r, 0, Math.PI * 2)
  x.lineWidth = 3
  x.strokeStyle = hexDe(v.color)
  x.stroke()
}

/** L'en-tête commun : la petite ligne, le grand titre, la ligne d'appoint. */
function entete(x: CanvasRenderingContext2D, sur: string, titre: string, sous: string, y: number): number {
  police(x, 22, 600, MONO)
  x.fillStyle = LAITON
  ecrire(x, sur.toUpperCase(), MARGE, y + 22, L - 2 * MARGE)
  police(x, 58, 700, SERIF)
  x.fillStyle = TEXTE
  ecrire(x, titre, MARGE, y + 96, L - 2 * MARGE)
  police(x, 26)
  x.fillStyle = PALE
  ecrire(x, sous, MARGE, y + 140, L - 2 * MARGE)
  return y + 176
}

/** Une rangée de chiffres en cases : le libellé, le chiffre, la précision. */
function chiffres(
  x: CanvasRenderingContext2D,
  cases: { lib: string; val: string; sous: string; ton?: string }[],
  y: number
): number {
  const gap = 16
  const w = (L - 2 * MARGE - gap * (cases.length - 1)) / cases.length
  const h = 170
  cases.forEach((c, i) => {
    const px = MARGE + i * (w + gap)
    rect(x, px, y, w, h, 16)
    x.fillStyle = CARTE
    x.fill()
    x.strokeStyle = TRAIT
    x.lineWidth = 2
    x.stroke()
    police(x, 19, 600, MONO)
    x.fillStyle = TERNE
    ecrire(x, c.lib.toUpperCase(), px + 22, y + 40, w - 44)
    police(x, 64, 700, SERIF)
    x.fillStyle = c.ton ?? TEXTE
    ecrire(x, c.val, px + 22, y + 112, w - 44)
    police(x, 20)
    x.fillStyle = PALE
    ecrire(x, c.sous, px + 22, y + 146, w - 44)
  })
  return y + h + 28
}

/** L'histogramme : une barre par valeur, le 20 en or et le 1 en rouge au dé seul. */
function histogramme(
  x: CanvasRenderingContext2D,
  comptes: number[],
  min: number,
  auDe: boolean,
  couleur: string,
  y: number
): number {
  const h = 260
  const nb = comptes.length
  const larg = L - 2 * MARGE
  const pas = larg / nb
  const haut = Math.max(...comptes, 1)
  /* La ligne de base, puis les barres. */
  x.fillStyle = TRAIT
  x.fillRect(MARGE, y + h, larg, 2)
  comptes.forEach((n, i) => {
    const v = min + i
    const bh = (n / haut) * (h - 36)
    x.fillStyle = auDe && v === 20 ? LAITON : auDe && v === 1 ? SANG : couleur
    if (bh > 0) {
      rect(x, MARGE + i * pas + pas * 0.14, y + h - bh, pas * 0.72, bh, Math.min(6, pas * 0.2))
      x.fill()
    }
    if (n > 0 && pas >= 30) {
      police(x, 18, 600)
      x.fillStyle = PALE
      x.textAlign = 'center'
      x.fillText(String(n), MARGE + i * pas + pas / 2, y + h - bh - 8)
      x.textAlign = 'left'
    }
    /* L'axe : toutes les valeurs, ou une sur deux quand c'est serré. */
    if (nb <= 22 || v % 2 === 0) {
      police(x, 18, 500, MONO)
      x.fillStyle = auDe && v === 20 ? LAITON : auDe && v === 1 ? SANG : TERNE
      x.textAlign = 'center'
      x.fillText(String(v), MARGE + i * pas + pas / 2, y + h + 30)
      x.textAlign = 'left'
    }
  })
  return y + h + 60
}

function titreSection(x: CanvasRenderingContext2D, t: string, y: number): number {
  police(x, 34, 700, SERIF)
  x.fillStyle = TEXTE
  x.fillText(t, MARGE, y + 34)
  return y + 58
}

function pied(x: CanvasRenderingContext2D, y: number): number {
  x.fillStyle = TRAIT
  x.fillRect(MARGE, y, L - 2 * MARGE, 2)
  police(x, 20, 500, MONO)
  x.fillStyle = TERNE
  x.fillText('ÉCRAN DU MAÎTRE', MARGE, y + 40)
  return y + 64
}

const mesureDite = (s: StatsEcran): string => (s.mesure === 'de' ? 'au dé seul' : 'avec modificateur')
const humeurDite = (s: StatsEcran): string =>
  s.humeur === 'chaud' ? 'dé chaud' : s.humeur === 'froid' ? 'dé froid' : 'dans la norme'
const nJets = (j: Joueur): number => j.n ?? j.comptes.reduce((a, b) => a + b, 0)

/* ============================================================
   Le groupe
   ============================================================ */

function dessinerGroupe(
  x: CanvasRenderingContext2D,
  s: StatsEcran,
  campagne: string | null,
  imgs: Map<string, HTMLImageElement>
): number {
  let y = entete(
    x,
    ['Statistiques de la séance', campagne].filter(Boolean).join(' · '),
    s.seance ?? 'La soirée en dés',
    `${s.n} jets de d20 · ${mesureDite(s)} · ${humeurDite(s)}`,
    MARGE
  )
  y = chiffres(
    x,
    [
      { lib: 'Jets', val: String(s.n), sous: s.rythme ? `${Math.round(s.rythme)} par heure` : 'de d20' },
      {
        lib: 'Moyenne',
        val: virgule(s.moyenne),
        sous: `${virgule(s.attendu)} attendu`,
        ton: s.humeur === 'chaud' ? LAITON : s.humeur === 'froid' ? '#5aa9c9' : TEXTE
      },
      {
        lib: 'Réussite',
        val: s.reussite ? `${s.reussite.taux} %` : '—',
        sous: s.reussite ? `sur ${s.reussite.juges} jugés` : 'aucun jet jugé'
      },
      { lib: '20 / 1', val: `${s.critiques} / ${s.maladresses}`, sous: 'naturels', ton: LAITON }
    ],
    y
  )

  y = titreSection(x, s.mesure === 'de' ? 'Les faces' : 'Les totaux', y)
  y = histogramme(x, s.histo.comptes, s.histo.min, s.mesure === 'de', '#5f7ad0', y)

  if (s.faits.length) {
    y = titreSection(x, 'Les faits', y)
    for (const f of s.faits) {
      rect(x, MARGE, y, L - 2 * MARGE, 76, 12)
      x.fillStyle = CARTE
      x.fill()
      police(x, 24)
      x.fillStyle = PALE
      ecrire(x, f.lib, MARGE + 24, y + 47, 360)
      police(x, 30, 700)
      x.fillStyle = TEXTE
      ecrire(x, f.val, MARGE + 400, y + 49, 300)
      police(x, 22)
      x.fillStyle = TERNE
      x.textAlign = 'right'
      ecrire(x, f.det, L - MARGE - 24, y + 47, 220)
      x.textAlign = 'left'
      y += 88
    }
    y += 20
  }

  if (s.joueurs.length) {
    y = titreSection(x, 'Les joueurs', y)
    /* Du meilleur au dernier, ici : on lit un classement de haut en bas. */
    const classes = [...s.joueurs].reverse()
    classes.forEach((j, i) => {
      rect(x, MARGE, y, L - 2 * MARGE, 104, 14)
      x.fillStyle = CARTE
      x.fill()
      police(x, 30, 700, SERIF)
      x.fillStyle = i === 0 ? LAITON : TERNE
      x.fillText(String(i + 1), MARGE + 24, y + 63)
      visage(x, j, imgs.get(j.nom), MARGE + 100, y + 52, 34)
      police(x, 28, 700)
      x.fillStyle = TEXTE
      ecrire(x, [j.nom, ...j.emojis].join(' '), MARGE + 152, y + 46, 520)
      police(x, 21)
      x.fillStyle = PALE
      ecrire(x, [j.perso, j.titre].filter(Boolean).join(' · ') || `${nJets(j)} jets`, MARGE + 152, y + 80, 520)
      police(x, 40, 700, SERIF)
      x.fillStyle = TEXTE
      x.textAlign = 'right'
      x.fillText(virgule(j.moyenne), L - MARGE - 24, y + 58)
      police(x, 19)
      x.fillStyle = TERNE
      x.fillText(`moyenne · ${nJets(j)} jets`, L - MARGE - 24, y + 86)
      x.textAlign = 'left'
      y += 116
    })
    y += 16
  }
  return pied(x, y)
}

/* ============================================================
   Un joueur
   ============================================================ */

function dessinerJoueur(
  x: CanvasRenderingContext2D,
  s: StatsEcran,
  j: Joueur,
  campagne: string | null,
  imgs: Map<string, HTMLImageElement>
): number {
  const couleur = hexDe(j.color)
  /* Une bande de sa couleur en haut : l'image est à lui. */
  x.fillStyle = couleur
  x.fillRect(0, 0, L, 12)

  let y = MARGE
  police(x, 22, 600, MONO)
  x.fillStyle = LAITON
  ecrire(x, ['Mes statistiques', s.seance ?? campagne].filter(Boolean).join(' · ').toUpperCase(), MARGE, y + 22, L - 2 * MARGE)
  y += 50
  visage(x, j, imgs.get(j.nom), MARGE + 70, y + 70, 70)
  police(x, 56, 700, SERIF)
  x.fillStyle = TEXTE
  ecrire(x, j.nom, MARGE + 170, y + 62, L - 2 * MARGE - 170)
  police(x, 26)
  x.fillStyle = PALE
  ecrire(x, [j.perso, j.titre].filter(Boolean).join(' · '), MARGE + 170, y + 104, L - 2 * MARGE - 170)
  if (j.emojis.length) {
    police(x, 38)
    x.fillText(j.emojis.join(' '), MARGE + 170, y + 150)
  }
  y += 190

  /* Son rang : les joueurs vont du dernier au meilleur. */
  const rang = s.joueurs.length - s.joueurs.findIndex((x2) => x2.id === j.id)
  const ecart = j.moyenne - j.attendu
  y = chiffres(
    x,
    [
      { lib: 'Jets', val: String(nJets(j)), sous: `sur ${s.n} à la table` },
      {
        lib: 'Moyenne',
        val: virgule(j.moyenne),
        sous: `${ecart >= 0 ? '+' : '−'}${virgule(Math.abs(ecart))} sur ${virgule(j.attendu)}`,
        ton: Math.abs(ecart) < 0.5 ? TEXTE : ecart > 0 ? LAITON : '#5aa9c9'
      },
      { lib: 'Rang', val: `${rang}${rang === 1 ? 'er' : 'e'}`, sous: `sur ${s.joueurs.length}` },
      ...(j.critiques != null
        ? [{ lib: '20 / 1', val: `${j.critiques} / ${j.maladresses ?? 0}`, sous: 'naturels', ton: LAITON }]
        : [])
    ],
    y
  )
  y = titreSection(x, s.mesure === 'de' ? 'Mes faces' : 'Mes totaux', y)
  y = histogramme(x, j.comptes, s.histo.min, s.mesure === 'de', couleur, y)
  police(x, 22)
  x.fillStyle = TERNE
  ecrire(x, `Mesuré ${mesureDite(s)}.`, MARGE, y + 8, L - 2 * MARGE)
  return pied(x, y + 40)
}

/* ============================================================
   L'image, prête à partager
   ============================================================ */

async function rendre(dessin: (x: CanvasRenderingContext2D) => number): Promise<Blob> {
  /* Une première passe sur une toile très haute pour mesurer, la vraie ensuite. */
  const essai = toile(6000)
  const h = dessin(essai.x)
  const { c, x } = toile(h)
  dessin(x)
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toile vide'))), 'image/png'))
}

export async function imageDuGroupe(s: StatsEcran, campagne: string | null): Promise<Blob> {
  const imgs = await portraits(s.joueurs)
  try {
    return await rendre((x) => dessinerGroupe(x, s, campagne, imgs))
  } catch {
    /* Un portrait a sali la toile : on refait sans eux. */
    return rendre((x) => dessinerGroupe(x, s, campagne, new Map()))
  }
}

export async function imageDuJoueur(s: StatsEcran, persoId: number, campagne: string | null): Promise<Blob | null> {
  const j = s.joueurs.find((x) => x.id === persoId)
  if (!j) return null
  const imgs = await portraits([j])
  try {
    return await rendre((x) => dessinerJoueur(x, s, j, campagne, imgs))
  } catch {
    return rendre((x) => dessinerJoueur(x, s, j, campagne, new Map()))
  }
}
