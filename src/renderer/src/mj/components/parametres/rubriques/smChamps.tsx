import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Les champs de la rubrique Santé mentale, partagés avec l'éditeur des
   événements : ils vivent à part pour que les deux fichiers ne s'importent
   pas l'un l'autre. */

/* ---------------- les champs : ils n'écrivent qu'au blur ---------------- */

export function Txt({
  v,
  onCommit,
  large,
  label
}: {
  v: string
  onCommit: (v: string) => void
  large?: boolean
  label: string
}): JSX.Element {
  const [t, setT] = useState(v)
  useEffect(() => setT(v), [v])
  /* Un texte long — « ce que ça change », une hallucination — revient à la
     ligne et le champ grandit avec lui : on relit tout sans faire défiler. */
  const zone = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const z = zone.current
    if (!z) return
    z.style.height = 'auto'
    z.style.height = `${z.scrollHeight + 2}px`
  }, [t])
  if (large)
    return (
      <textarea
        ref={zone}
        rows={1}
        className="sm-large"
        value={t}
        aria-label={label}
        onChange={(e) => setT(e.target.value)}
        /* Une seule ligne de sens : Entrée valide, comme dans un champ. */
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
        onBlur={() => t !== v && onCommit(t)}
      />
    )
  return (
    <input
      type="text"
      className={large ? 'sm-large' : undefined}
      value={t}
      aria-label={label}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => t !== v && onCommit(t)}
    />
  )
}

/** Un nombre ; vide, il vaut `null` si le champ le permet. */
export function Num({
  v,
  onCommit,
  nul,
  label,
  min
}: {
  v: number | null
  onCommit: (v: number | null) => void
  nul?: boolean
  label: string
  min?: number
}): JSX.Element {
  const [t, setT] = useState(v === null ? '' : String(v))
  useEffect(() => setT(v === null ? '' : String(v)), [v])
  const valider = (): void => {
    if (t.trim() === '') {
      if (nul) v !== null && onCommit(null)
      else setT(v === null ? '' : String(v))
      return
    }
    const n = Number(t)
    if (!Number.isFinite(n)) return setT(v === null ? '' : String(v))
    if (n !== v) onCommit(n)
  }
  return (
    <input
      type="number"
      className="sm-num"
      min={min}
      value={t}
      placeholder={nul ? '—' : undefined}
      aria-label={label}
      onChange={(e) => setT(e.target.value)}
      onBlur={valider}
    />
  )
}

export function Champ({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="sm-champ">
      <span>{label}</span>
      {children}
    </label>
  )
}
