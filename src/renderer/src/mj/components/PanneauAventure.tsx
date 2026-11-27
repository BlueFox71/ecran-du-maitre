/**
 * Le panneau Aventure d'un personnage WoW, sur sa fiche de l'Écran : ce qu'il
 * porte, ce qu'il transporte, ses talents et ses sorts, tels que son Aventure
 * les montre (voir `main/wowFiches.ts`). Le MJ y donne un objet du catalogue
 * du jeu, ou en reprend un : l'Aventure du joueur le reçoit tout de suite s'il
 * est en ligne, à sa prochaine connexion sinon.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Character } from '@shared/types'
import { ECOLES_WOW, EMPLACEMENTS_WOW, type CatalogueObjetWow, type ObjetFicheWow } from '@shared/wow'

const Nom = ({ nom, q }: { nom: string; q: number }): JSX.Element => <span className={`wow-q wow-q${q}`}>{nom}</span>

export function PanneauAventure({ ch }: { ch: Character }): JSX.Element | null {
  const s = useStore()
  const [lie, setLie] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<'objets' | 'talents' | 'sorts'>('objets')
  const [texte, setTexte] = useState('')
  const [trouves, setTrouves] = useState<CatalogueObjetWow[]>([])
  const [combien, setCombien] = useState(1)
  const [niveau, setNiveau] = useState(String(ch.data.niveauWow ?? ''))

  /* Le champ suit la fiche, sauf pendant qu'on y écrit. */
  useEffect(() => setNiveau(String(ch.data.niveauWow ?? '')), [ch.id, ch.data.niveauWow])

  useEffect(() => {
    let vivant = true
    void window.jdr.wow.joueurDe(ch.id).then((j) => vivant && setLie(j))
    return () => {
      vivant = false
    }
  }, [ch.id])

  /* La recherche dans le catalogue, quand la main s'arrête. */
  useEffect(() => {
    if (texte.trim().length < 2) return setTrouves([])
    const t = setTimeout(() => void window.jdr.wow.chercherObjets(texte).then(setTrouves), 250)
    return () => clearTimeout(t)
  }, [texte])

  if (s.reglages.regles !== 'wow' || !lie) return null

  const av = ch.data.aventureWow
  const envoyer = async (envoi: ObjetFicheWow, dit: string): Promise<void> => {
    try {
      const r = await window.jdr.wow.objetFiche(ch.id, envoi)
      if (r === 'recu') s.toast(dit)
      else if (r === 'en-attente') s.toast(`${dit} — ${ch.name} le recevra à sa prochaine connexion`)
      else s.toast(`${dit} : l’Aventure de ${ch.name} est introuvable`, true)
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    }
  }

  const poserNiveau = async (): Promise<void> => {
    const n = Math.round(Number(niveau))
    if (!n || n === ch.data.niveauWow) return setNiveau(String(ch.data.niveauWow ?? ''))
    await window.jdr.wow.niveau(ch.id, n)
    await s.refreshCharacters()
    s.toast(`${ch.name} passe niveau ${n}`)
  }

  const portes = av ? EMPLACEMENTS_WOW.map(([c, lbl]) => ({ c, lbl, o: av.equip.find((x) => x.c === c) })) : []

  return (
    <section className="sect sect-aventure-wow">
      <div className="sect-tete">
        <span className="eyebrow">Aventure</span>
        <div className="wow-onglets" role="tablist">
          {(
            [
              ['objets', 'Objets'],
              ['talents', `Talents${av ? ` (${av.talents.length})` : ''}`],
              ['sorts', `Sorts${av ? ` (${av.sorts.length})` : ''}`]
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={onglet === k}
              className={`btn btn-sm${onglet === k ? ' on' : ' btn-ghost'}`}
              onClick={() => setOnglet(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <label className="wow-niveau" title="Le niveau du personnage : son Aventure le suit">
          Niveau
          <input
            type="number"
            min={1}
            max={60}
            value={niveau}
            onChange={(e) => setNiveau(e.target.value)}
            onBlur={() => void poserNiveau()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
      </div>

      <BlocCombat ch={ch} />

      {!av ? (
        <p className="rien">
          Le détail arrivera dès que {ch.name} ouvrira son Aventure. Tu peux déjà lui donner des objets : il les
          recevra à sa connexion.
        </p>
      ) : onglet === 'objets' ? (
        <div className="wow-objets">
          <div>
            <h5>Équipement</h5>
            <ul className="wow-liste">
              {portes.map(({ c, lbl, o }) => (
                <li key={c}>
                  <span className="wow-lbl">{lbl}</span>
                  {o ? <Nom nom={o.nom} q={o.q} /> : <span className="wow-vide">—</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Sacs ({av.sacs.length})</h5>
            {av.sacs.length === 0 ? (
              <p className="rien">Ses sacs sont vides.</p>
            ) : (
              <ul className="wow-liste">
                {av.sacs.map((o, i) => (
                  <li key={`${o.nom}-${i}`}>
                    <Nom nom={o.nom} q={o.q} />
                    {o.qte > 1 ? <span className="wow-qte">×{o.qte}</span> : null}
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Le reprendre (un exemplaire)"
                      onClick={() => void envoyer({ t: 'retireObjet', nom: o.nom, n: 1 }, `${o.nom} repris à ${ch.name}`)}
                    >
                      Reprendre
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : onglet === 'talents' ? (
        av.talents.length === 0 ? (
          <p className="rien">{ch.name} n’a encore choisi aucun talent.</p>
        ) : (
          <ul className="wow-liste wow-colonnes">
            {av.talents.map((t) => (
              <li key={t.nom}>
                {t.nom}
                <span className="wow-qte">
                  {t.rang}/{t.max}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : av.sorts.length === 0 ? (
        <p className="rien">{ch.name} ne connaît encore aucun sort.</p>
      ) : (
        <ul className="wow-liste wow-colonnes">
          {av.sorts.map((sp) => (
            <li key={sp.nom}>
              {sp.nom}
              <span className="wow-qte">niv. {sp.niveau}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="wow-donner">
        <h5>Donner un objet</h5>
        <div className="az-ligne">
          <input
            type="text"
            placeholder="Chercher dans le catalogue du jeu…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
          />
          <input
            type="number"
            min={1}
            max={999}
            value={combien}
            onChange={(e) => setCombien(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            aria-label="Combien"
            title="Combien d’exemplaires"
          />
        </div>
        {trouves.length > 0 ? (
          <ul className="wow-liste wow-trouves">
            {trouves.map((o) => (
              <li key={o.id}>
                <Nom nom={o.nom} q={o.qualite} />
                <span className="wow-lbl">{[o.niveau ? `niv. ${o.niveau}` : '', o.type].filter(Boolean).join(' · ')}</span>
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    void envoyer(
                      { t: 'objet', id: o.id, n: combien },
                      `${o.nom}${combien > 1 ? ` ×${combien}` : ''} donné à ${ch.name}`
                    )
                  }
                >
                  Donner
                </button>
              </li>
            ))}
          </ul>
        ) : texte.trim().length >= 2 ? (
          <p className="rien">Aucun objet de ce nom dans le catalogue.</p>
        ) : null}
      </div>
    </section>
  )
}

/** Un total de combat : il part à l'Aventure quand la main quitte le champ. */
function Total({ label, valeur, onPoser }: { label: string; valeur: number | undefined; onPoser: (n: number) => void }): JSX.Element {
  const [v, setV] = useState(valeur === undefined ? '' : String(valeur))
  useEffect(() => setV(valeur === undefined ? '' : String(valeur)), [valeur])
  return (
    <label className="wow-total">
      <span>{label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.round(Number(v))
          if (v.trim() === '' || !Number.isFinite(n) || n === valeur) return setV(valeur === undefined ? '' : String(valeur))
          onPoser(n)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}

/** Armure, défense, initiative et résistances : les totaux de son Aventure, réglés ici. */
function BlocCombat({ ch }: { ch: Character }): JSX.Element {
  const s = useStore()
  const c = ch.data.combatWow
  const poser = async (p: string, n: number, dit: string): Promise<void> => {
    await window.jdr.wow.combat(ch.id, { [p]: n })
    await s.refreshCharacters()
    s.toast(`${ch.name} : ${dit} ${n}`)
  }
  return (
    <div className="wow-combat">
      <h5>Combat</h5>
      <div className="wow-totaux">
        <Total label="Armure" valeur={c?.armure} onPoser={(n) => void poser('total.armure', n, 'armure')} />
        <Total label="Défense" valeur={c?.defense} onPoser={(n) => void poser('total.defense', n, 'défense')} />
        <Total label="Initiative" valeur={c?.initiative} onPoser={(n) => void poser('total.initiative', n, 'initiative')} />
      </div>
      <h5>Résistances</h5>
      <div className="wow-totaux">
        {ECOLES_WOW.map(([k, l]) => (
          <Total key={k} label={l} valeur={c?.resist[k]} onPoser={(n) => void poser(`total.resist.${k}`, n, `résistance ${l.toLowerCase()}`)} />
        ))}
      </div>
      {!c ? <p className="rien">Les valeurs arriveront dès que son Aventure sera ouverte ; tu peux déjà les régler.</p> : null}
    </div>
  )
}
