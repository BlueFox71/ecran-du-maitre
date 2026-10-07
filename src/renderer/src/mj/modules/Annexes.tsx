import { useRef, useState } from 'react'
import { useStore } from '../store'
import { IconClose, IconDoc, IconLink, IconPen, IconPlus, IconSearch } from '../components/Icons'
import { SousMenuPreparation } from '../components/SousMenuPreparation'
import { TexteEnPlace } from '../components/TexteEnPlace'
import type { UiFolder, UiItem } from '../../../../preload/index'

/* ============================================================
   Documents annexes : ce qu'on garde sous la main toute la séance —
   règles maison, fiches de PNJ, tables de jets. On les choisit ici,
   en préparant ; ils sortaient autrefois d'un volet de la Chronologie.
   ============================================================ */

/** Le dossier où naissent les textes écrits pour les annexes, à la racine de la campagne. */
const DOSSIER_ANNEXES = 'Annexes'

export function Annexes(): JSX.Element {
  const s = useStore()
  const [vu, setVu] = useState<number | null>(null)
  const [choix, setChoix] = useState(false)
  /* Le texte qu'on écrit sur place, comme dans la Chronologie. */
  const [enEdition, setEnEdition] = useState<number | null>(null)

  /* Les annexes valent pour toute la campagne : leurs textes vont dans un
     dossier « Annexes » à la racine, créé au premier texte. */
  const dossierDesAnnexes = async (): Promise<string> => {
    const existe = (ns: UiFolder[]): boolean =>
      ns.some((f) => f.relPath === DOSSIER_ANNEXES || existe(f.children))
    if (existe(useStore.getState().tree)) return DOSSIER_ANNEXES
    return window.jdr.folders.create('', DOSSIER_ANNEXES)
  }

  const creation = useRef(false)
  const creerTexte = async (): Promise<void> => {
    if (creation.current) return
    creation.current = true
    try {
      const dossier = await dossierDesAnnexes()
      const it = await window.jdr.items.createDoc(dossier, 'Nouvelle annexe')
      if (!it) return s.toast('Le texte n’a pas pu être créé.', true)
      await window.jdr.annexes.add(it.id)
      await Promise.all([s.refreshLibrary(), s.refreshAnnexes()])
      setVu(it.id)
      setEnEdition(it.id)
    } finally {
      creation.current = false
    }
  }

  /* Le nom du document est son nom de fichier : le changer le renomme sur le
     disque. Il garde son identifiant, donc sa place dans les annexes. */
  const renommer = async (it: UiItem, titre: string): Promise<void> => {
    if (!it.relPath || !titre.trim() || titre.trim() === it.title) return
    try {
      await window.jdr.items.rename(it.relPath, titre.trim())
      await Promise.all([s.refreshLibrary(), s.refreshAnnexes()])
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    }
  }

  const doc = s.annexes.find((a) => a.id === vu) ?? s.annexes[0] ?? null

  const retirer = async (id: number): Promise<void> => {
    await window.jdr.annexes.remove(id)
    await s.refreshAnnexes()
    if (vu === id) setVu(null)
  }

  return (
    <section className="view chrono">
      <div className="vhead">
        <SousMenuPreparation />
      </div>
      <div className="vhead">
        <div>
          <h2>Documents annexes</h2>
          <p>
            Les textes que tu consultes en cours de partie&nbsp;: règles maison, fiches de PNJ,
            tables de jets. Choisis-les ici&nbsp;; ils restent sous la main toute la séance.
          </p>
        </div>
        <div className="spacer" />
        <span className="eyebrow">
          {s.annexes.length} document{s.annexes.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="annexes-grid">
        {/* ---- la liste ---- */}
        <aside className="pane">
          <div className="pane-head">
            <span className="eyebrow">Sous la main</span>
            <div className="spacer" />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void creerTexte()}
              title="Écrire un nouveau texte, rangé dans le dossier « Annexes » de la campagne"
            >
              <IconPen />
              Nouveau texte
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setChoix(true)}
              title="Prendre un texte déjà dans la campagne"
            >
              <IconPlus />
              Ajouter
            </button>
          </div>
          <div className="pane-body">
            <div className="fil">
              {s.annexes.map((a) => (
                <button
                  key={a.id}
                  className={`moment${doc?.id === a.id ? ' on' : ''}`}
                  onClick={() => {
                    setVu(a.id)
                    setEnEdition(null)
                  }}
                  title={a.relPath ?? a.title}
                >
                  <span className="t">
                    <span className="ttl">{a.title}</span>
                    {a.relPath ? <span className="sub">{dossierDe(a)}</span> : null}
                  </span>
                  <span
                    className="annexe-oter"
                    role="button"
                    tabIndex={0}
                    title="Retirer des annexes (le fichier reste dans la Bibliothèque)"
                    onClick={(e) => {
                      e.stopPropagation()
                      void retirer(a.id)
                    }}
                  >
                    <IconClose />
                  </span>
                </button>
              ))}
              {s.annexes.length === 0 ? (
                <p className="vide">Aucun document. Ajoute le premier.</p>
              ) : null}
            </div>
          </div>
        </aside>

        {/* ---- la lecture ---- */}
        <section className="pane lecture annexes">
          {doc ? (
            <div className="pane-body annexes-corps">
              <h4 className="a-titre">
                <IconDoc />
                {/* Le nom se corrige là où on le lit : Entrée valide, Échap renonce. */}
                <input
                  key={doc.title}
                  className="a-nom"
                  defaultValue={doc.title}
                  aria-label="Nom du document"
                  title="Cliquer pour renommer le document"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') {
                      e.currentTarget.value = doc.title
                      e.currentTarget.blur()
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) e.target.value = doc.title
                    else void renommer(doc, e.target.value)
                  }}
                />
                <span className="spacer" />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => s.openInEditor(doc.id)}
                  title="Ouvrir dans l’Éditeur complet"
                >
                  <IconPen />
                  Éditeur
                </button>
              </h4>
              {enEdition === doc.id ? (
                <TexteEnPlace
                  key={doc.id}
                  item={doc}
                  onFini={() => setEnEdition(null)}
                  versEditeur={() => s.openInEditor(doc.id)}
                />
              ) : (
                <div
                  className="read-body a-ecrire"
                  role="button"
                  tabIndex={0}
                  title="Cliquer pour écrire ce texte"
                  onClick={() => setEnEdition(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEnEdition(doc.id)
                  }}
                  dangerouslySetInnerHTML={{
                    __html: doc.body || '<p class="rien">Ce texte est vide.</p>'
                  }}
                />
              )}
            </div>
          ) : (
            <p className="vide-grand">
              Rien sous la main.
              <br />
              Écris un nouveau texte, ou ajoute ceux que tu consultes en cours de partie : règles
              maison, fiches de PNJ, tables de jets.
            </p>
          )}
        </section>
      </div>

      {choix ? (
        <ChoixDoc
          titre="Garder un document sous la main"
          exclure={s.annexes.map((a) => a.id)}
          onClose={() => setChoix(false)}
          onPick={async (it) => {
            await window.jdr.annexes.add(it.id)
            await s.refreshAnnexes()
            setVu(it.id)
            setChoix(false)
          }}
        />
      ) : null}
    </section>
  )
}

function dossierDe(it: UiItem): string {
  const p = it.relPath ?? ''
  const i = p.lastIndexOf('/')
  return i < 0 ? 'racine' : p.slice(0, i)
}

/* ============================================================
   Choisir un texte déjà dans la campagne
   ============================================================ */

function ChoixDoc({
  titre,
  exclure,
  onPick,
  onClose
}: {
  titre: string
  exclure: number[]
  onPick: (it: UiItem) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')

  const mot = q.trim().toLowerCase()
  const liste = s.fichiers
    .filter((i) => i.kind === 'doc' && !exclure.includes(i.id))
    .filter((i) => !mot || `${i.title} ${i.relPath ?? ''}`.toLowerCase().includes(mot))
    .slice(0, 200)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconLink />
          <h3>{titre}</h3>
        </header>

        <div className="body">
          <label className="cherche">
            <IconSearch />
            <input
              type="text"
              autoFocus
              value={q}
              placeholder="Chercher un texte par son nom ou son dossier"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="liste-docs">
            {liste.map((it) => (
              <button key={it.id} className="doc-row" onClick={() => onPick(it)}>
                <IconDoc />
                <span className="t">
                  <span className="ttl">{it.title}</span>
                  <span className="sub">{dossierDe(it)}</span>
                </span>
              </button>
            ))}
            {liste.length === 0 ? (
              <p className="vide">
                {mot ? 'Aucun texte ne correspond.' : 'Aucun texte disponible.'}
              </p>
            ) : null}
          </div>
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </footer>
      </div>
    </div>
  )
}
