/**
 * Le graveur : la page qui regarde les médias à la place du MJ.
 *
 * Elle ne montre rien et n'est jamais affichée. Elle demande du travail au
 * processus principal, charge un média, relève ses mesures, saisit une image,
 * la rend, et recommence jusqu'à ce qu'il n'y ait plus rien. Voir
 * `src/main/examen.ts`, qui l'ouvre et la referme.
 *
 * Trois précautions, chacune payée d'une déconvenue :
 *  - un média est chargé **avec sa patience** : un fichier dont Chromium ne sait
 *    rien faire ne répond ni par `load` ni par `error`, il se tait ;
 *  - la première image d'une vidéo est presque toujours noire — on va la
 *    chercher un peu plus loin, au dixième de sa durée ;
 *  - un échec reste un résultat : on le rend quand même, sinon le même fichier
 *    reviendrait à chaque relecture du dossier.
 */
import type { ExamenFait, ExamenJob } from '@shared/types'

/** Le côté le plus long d'une vignette. Au-delà, c'est du poids pour rien. */
const COTE = 480
const QUALITE = 0.72
/** Au-delà, le fichier est réputé illisible et on passe au suivant. */
const PATIENCE = 15000
/** Garde-fou : une file qui ne se vide pas est un défaut, pas une charge. */
const MAX = 5000

type Mesures = Pick<ExamenFait, 'width' | 'height' | 'duration' | 'vignette'>

const rien: Mesures = { width: null, height: null, duration: null, vignette: null }

/* ---------------- la gravure ---------------- */

const toile = document.createElement('canvas')

/**
 * Dessine la source à sa proportion, dans un cadre dont le plus grand côté fait
 * `COTE`. Une image plus petite que le cadre n'est pas agrandie : on ne gagne
 * rien à graver du flou.
 */
function graver(source: CanvasImageSource, w: number, h: number): string | null {
  if (!w || !h) return null
  const k = Math.min(1, COTE / Math.max(w, h))
  toile.width = Math.max(1, Math.round(w * k))
  toile.height = Math.max(1, Math.round(h * k))
  const ctx = toile.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, toile.width, toile.height)
  return toile.toDataURL('image/jpeg', QUALITE)
}

/* ---------------- les trois natures ---------------- */

function examinerImage(url: string): Promise<Mesures> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      let vignette: string | null = null
      try {
        vignette = graver(img, w, h)
      } catch {
        vignette = null
      }
      resolve({ width: w || null, height: h || null, duration: null, vignette })
    }
    img.onerror = () => reject(new Error('image illisible'))
    img.src = url
  })
}

function examinerVideo(url: string): Promise<Mesures> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.preload = 'auto'
    v.muted = true
    v.playsInline = true

    let mesures: Mesures | null = null
    const rendre = (vignette: string | null): void => {
      const r = { ...(mesures ?? rien), vignette }
      v.removeAttribute('src')
      v.load()
      resolve(r)
    }

    const saisir = (): void => {
      try {
        rendre(graver(v, v.videoWidth, v.videoHeight))
      } catch {
        rendre(null)
      }
    }

    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null
      mesures = { width: v.videoWidth || null, height: v.videoHeight || null, duration: d, vignette: null }
      // Le générique de début, le fondu au noir, le logo : le premier dixième
      // ne montre pas la scène. On s'y avance sans jamais dépasser trois
      // secondes, pour ne pas faire télécharger un film entier.
      const t = d ? Math.min(d * 0.1, 3) : 0
      if (t > 0) v.currentTime = t
      else saisir()
    }
    v.onseeked = saisir
    v.onerror = () => {
      // Le conteneur peut livrer ses mesures et refuser ses images (un .mkv que
      // Chromium n'ouvre pas) : ce qu'on a déjà, on le garde.
      if (mesures) rendre(null)
      else reject(new Error('vidéo illisible'))
    }
    v.src = url
  })
}

function examinerSon(url: string): Promise<Mesures> {
  return new Promise((resolve, reject) => {
    const a = document.createElement('audio')
    a.crossOrigin = 'anonymous'
    a.preload = 'auto'

    const lue = (): number | null =>
      Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null
    const rendre = (d: number | null): void => {
      a.removeAttribute('src')
      a.load()
      resolve({ ...rien, duration: d })
    }

    a.onloadedmetadata = () => {
      const d = lue()
      if (d) return rendre(d)
      /* Un mp3 à débit constant ne porte pas sa durée : sans en-tête Xing,
         Chromium répond « l'infini » tant qu'il n'a pas atteint la fin. On l'y
         envoie — c'est le seul moyen connu de la lui faire dire. Sur dix-neuf
         bruitages de la campagne d'essai, dix-huit répondaient ainsi. */
      a.currentTime = 1e101
    }
    a.ondurationchange = () => {
      const d = lue()
      if (d) rendre(d)
    }
    a.onerror = () => reject(new Error('son illisible'))
    a.src = url
  })
}

function examiner(job: ExamenJob): Promise<Mesures> {
  if (job.kind === 'video') return examinerVideo(job.url)
  if (job.kind === 'audio') return examinerSon(job.url)
  return examinerImage(job.url)
}

/** La même promesse, mais qui finit toujours par répondre. */
function avecPatience<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('sans réponse')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

/* ---------------- le tour de garde ---------------- */

async function tourner(): Promise<void> {
  for (let n = 0; n < MAX; n++) {
    const job = await window.jdr.examen.suivant()
    if (!job) break

    let mesures: Mesures = rien
    let erreur: string | null = null
    try {
      mesures = await avecPatience(examiner(job), PATIENCE)
    } catch (e) {
      erreur = `${job.titre} — ${(e as Error)?.message ?? e}`
    }
    await window.jdr.examen.fait({ id: job.id, sig: job.sig, ...mesures, erreur })
  }
  await window.jdr.examen.fini()
}

void tourner()
