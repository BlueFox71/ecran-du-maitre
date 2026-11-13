/**
 * Importer une image comme asset de l'atelier.
 *
 * L'image est traitée ici, avant d'être rangée : son fond retiré (magenta ou
 * noir, comme les planches qu'on fait générer), ses bords vides rognés pour
 * un objet, ses coutures atténuées pour une texture. Rangée ensuite dans la
 * bibliothèque du MJ, commune à toutes ses campagnes.
 */
import { useState } from 'react'
import {
  boiteOpaque,
  detourerMagenta,
  lumiereEnAlpha,
  raccorder,
  type TypeAsset
} from '@shared/atelierAssets'
import { useStore } from '../store'
import type { PropsEtape } from '../modules/Atelier'

type Fond = 'transparent' | 'magenta' | 'noir'

const TYPES: { id: TypeAsset; label: string }[] = [
  { id: 'objet', label: 'Objet' },
  { id: 'sol', label: 'Sol' },
  { id: 'mur', label: 'Mur' },
  { id: 'porte', label: 'Porte' },
  { id: 'vitre', label: 'Fenêtre' }
]

const CATEGORIE: Record<TypeAsset, string> = {
  objet: 'Mes objets',
  sol: 'Sols',
  mur: 'Murs',
  porte: 'Portes et fenêtres',
  vitre: 'Portes et fenêtres'
}

async function traiter(
  fichier: File,
  type: TypeAsset,
  fond: Fond,
  raccord: boolean
): Promise<{ png: Uint8Array; ratio: number }> {
  const bitmap = await createImageBitmap(fichier)
  let cv = document.createElement('canvas')
  cv.width = bitmap.width
  cv.height = bitmap.height
  let ctx = cv.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  let img = ctx.getImageData(0, 0, cv.width, cv.height)
  let px: Uint8ClampedArray = img.data
  if (fond === 'magenta') px = detourerMagenta(px)
  if (fond === 'noir') px = lumiereEnAlpha(px)
  let w = cv.width
  let h = cv.height
  if (type === 'objet' || type === 'porte' || type === 'vitre') {
    const b = boiteOpaque(px, w, h)
    if (!b) throw new Error('L’image est vide une fois son fond retiré.')
    const plein = new ImageData(new Uint8ClampedArray(px), w, h)
    ctx.putImageData(plein, 0, 0)
    const rogne = ctx.getImageData(b.x, b.y, b.w, b.h)
    px = rogne.data
    w = b.w
    h = b.h
  } else if (raccord) px = raccorder(px, w, h, type === 'mur')
  cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  ctx = cv.getContext('2d')!
  ctx.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0)
  img = ctx.getImageData(0, 0, 1, 1)
  const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('L’image n’a pas pu être convertie.')
  return { png: new Uint8Array(await blob.arrayBuffer()), ratio: h / w }
}

export function ImportAsset({
  recharger,
  typeParDefaut
}: PropsEtape & { typeParDefaut: TypeAsset }): JSX.Element {
  const toast = useStore((s) => s.toast)
  const [ouvert, setOuvert] = useState(false)
  const [fichier, setFichier] = useState<File | null>(null)
  const [type, setType] = useState<TypeAsset>(typeParDefaut)
  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('')
  const [taille, setTaille] = useState(1)
  const [pas, setPas] = useState(false)
  const [vue, setVue] = useState(false)
  const [fond, setFond] = useState<Fond>('transparent')
  const [raccord, setRaccord] = useState(true)
  const [encours, setEncours] = useState(false)

  if (!ouvert)
    return (
      <button className="btn btn-sm" onClick={() => setOuvert(true)}>
        Importer une image…
      </button>
    )

  const texture = type === 'sol' || type === 'mur'
  const importer = async (): Promise<void> => {
    if (!fichier) return
    setEncours(true)
    try {
      const { png, ratio } = await traiter(fichier, type, fond, texture && raccord)
      await window.jdr.atelier.importer(
        {
          type,
          nom: nom.trim() || fichier.name.replace(/\.[^.]+$/, ''),
          categorie: categorie.trim() || CATEGORIE[type],
          ...(texture ? { tuile: taille } : {}),
          ...(type === 'objet'
            ? { l: taille, h: Math.round(taille * ratio * 100) / 100, bloquePas: pas, bloqueVue: vue }
            : {})
        },
        png
      )
      await recharger()
      toast(`« ${nom.trim() || fichier.name} » est dans ta bibliothèque d’assets.`)
      setOuvert(false)
      setFichier(null)
      setNom('')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), true)
    } finally {
      setEncours(false)
    }
  }

  return (
    <div className="at-section at-import">
      <span className="eyebrow">Importer une image</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      <label className="at-reglage">
        Type
        <select value={type} onChange={(e) => setType(e.target.value as TypeAsset)}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <input className="at-champ" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
      <input
        className="at-champ"
        placeholder={`Catégorie (${CATEGORIE[type]})`}
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
      />
      {type === 'objet' || texture ? (
        <label className="at-reglage">
          {type === 'objet' ? 'Largeur réelle, en cases' : 'Une tuile couvre, en cases'}
          <input type="number" min={0.1} max={20} step={0.1} value={taille} onChange={(e) => setTaille(Number(e.target.value) || 1)} />
        </label>
      ) : null}
      <label className="at-reglage">
        Fond de l’image
        <select value={fond} onChange={(e) => setFond(e.target.value as Fond)}>
          <option value="transparent">Déjà transparent</option>
          <option value="magenta">Magenta, à retirer</option>
          <option value="noir">Noir : la clarté devient l’opacité (toiles, fumée)</option>
        </select>
      </label>
      {type === 'objet' ? (
        <>
          <label className="at-case">
            <input type="checkbox" checked={pas} onChange={(e) => setPas(e.target.checked)} />
            Bloque le passage, par défaut
          </label>
          <label className="at-case">
            <input type="checkbox" checked={vue} onChange={(e) => setVue(e.target.checked)} />
            Bloque la vue, par défaut
          </label>
        </>
      ) : null}
      {texture ? (
        <label className="at-case">
          <input type="checkbox" checked={raccord} onChange={(e) => setRaccord(e.target.checked)} />
          Rendre raccordable
        </label>
      ) : null}
      <div className="at-outils">
        <button className="btn btn-sm btn-brass" disabled={!fichier || encours} onClick={() => void importer()}>
          {encours ? 'Import…' : 'Importer'}
        </button>
        <button className="btn btn-sm" onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </div>
  )
}
