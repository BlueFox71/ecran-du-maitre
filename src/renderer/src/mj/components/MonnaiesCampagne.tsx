import { useState } from 'react'
import { itemById, useStore } from '../store'
import { Piece } from '../../shared/Piece'
import { ChoixDansArbre } from './ChoixDansArbre'
import { IconImage, IconPlus, IconTrash } from './Icons'
import {
  MODELES_MONNAIE,
  TEINTES_MONNAIE,
  nouvelleCle,
  type Monnaie,
  type ReglageMonnaies,
  type TeinteMonnaie
} from '@shared/monnaies'

/**
 * Le bloc « Monnaies » des Paramètres (Règles du jeu).
 *
 * Les monnaies sont un réglage de la campagne (`setting['monnaies']`) et ne
 * partent pas dans les modèles de fiche. Ce qu'on change ici est un brouillon,
 * tenu par la fenêtre des Paramètres : il attend « Appliquer les monnaies ».
 *
 * Une monnaie déjà posée sur les fiches (`posees`) se renomme, change d'image
 * ou de taux, mais ne se supprime plus : des bourses et des prix y sont
 * écrits. Pour ne plus en voir aucune, la campagne passe à « pas de monnaie ».
 */
export function MonnaiesCampagne({
  r,
  posees,
  onChange: poser
}: {
  r: ReglageMonnaies
  posees: Set<string>
  onChange: (r: ReglageMonnaies) => void
}): JSX.Element {
  const s = useStore()
  const [image, setImage] = useState<string | null>(null)
  const [tiree, setTiree] = useState<number | null>(null)

  const change = (i: number, patch: Partial<Monnaie>): void =>
    poser({ ...r, liste: r.liste.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  /* Un modèle remplacerait des monnaies déjà sur les fiches : seulement au départ. */
  const modeles = posees.size === 0

  /**
   * Repartir d'un modèle. Les clés déjà là sont reprises dans l'ordre : la
   * première monnaie garde la sienne, et avec elle les prix et les bourses
   * qui y étaient écrits.
   */
  const partirDe = (liste: Omit<Monnaie, 'key'>[]): void => {
    const prises: string[] = []
    poser({
      actif: true,
      liste: liste.map((m, i) => {
        const key = r.liste[i]?.key ?? nouvelleCle(m.nom, [...prises, ...r.liste.map((x) => x.key)])
        prises.push(key)
        return { ...m, key }
      })
    })
  }

  const ajouter = (): void => {
    const nom = 'Nouvelle monnaie'
    poser({
      ...r,
      liste: [
        ...r.liste,
        {
          key: nouvelleCle(nom, r.liste.map((m) => m.key)),
          nom,
          abbr: '',
          teinte: 'bleu',
          imageItemId: null,
          taux: null
        }
      ]
    })
  }

  const deplacer = (de: number, vers: number): void => {
    if (de === vers) return
    const liste = [...r.liste]
    const [m] = liste.splice(de, 1)
    liste.splice(vers, 0, m)
    /* La plus forte n'a pas de change : il ne voudrait plus rien dire. */
    if (liste[0]) liste[0] = { ...liste[0], taux: null }
    poser({ ...r, liste })
  }

  const enImage = r.liste.find((m) => m.key === image) ?? null

  return (
    <section className="card fc-carte mc">
      <header>
        <h4>Les monnaies</h4>
        <span className="sous">
          réglées pour la campagne seulement — elles ne partent pas dans les modèles
        </span>
        <div className="spacer" />
        <span className="mc-enr">appliqué avec la fiche</span>
      </header>

      <div className="fc-defile mc-corps">
        <div className="mc-barre">
          <span className="eyebrow">Cette campagne</span>
          <div className="mc-seg" role="group" aria-label="Système de monnaie">
            <button aria-pressed={r.actif} onClick={() => poser({ ...r, actif: true })}>
              a de l’argent
            </button>
            <button aria-pressed={!r.actif} onClick={() => poser({ ...r, actif: false })}>
              n’a pas de monnaie
            </button>
          </div>
          <div className="spacer" />
          <span className="eyebrow">Partir de</span>
          <div className="mc-seg" role="group" aria-label="Modèle de monnaie">
            {MODELES_MONNAIE.map((m) => (
              <button
                key={m.nom}
                disabled={!modeles}
                title={
                  modeles
                    ? undefined
                    : 'Des monnaies sont déjà sur les fiches : on les modifie, on ne les remplace plus'
                }
                onClick={() => partirDe(m.liste)}
              >
                {m.nom}
              </button>
            ))}
          </div>
        </div>

        {!r.actif ? (
          <div className="fc-vide mc-sans">
            Pas de monnaie : la bourse disparaît des fiches et des téléphones, le prix disparaît
            des objets. Ce qui avait été saisi est gardé — revenir à «&nbsp;a de l’argent&nbsp;» le
            retrouve.
          </div>
        ) : (
          <>
            {r.liste.length === 0 ? (
              <div className="fc-vide">
                Aucune monnaie. Ajoute-en une, ou choisis «&nbsp;n’a pas de monnaie&nbsp;».
              </div>
            ) : (
              <div className="mc-lignes">
                {r.liste.map((m, i) => {
                  const img = itemById(s.allItems, m.imageItemId)
                  const prec = r.liste[i - 1]
                  return (
                    <div
                      className={`mc-ligne${tiree === i ? ' tiree' : ''}`}
                      key={m.key}
                      onDragOver={(e) => {
                        if (tiree === null) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (tiree !== null) deplacer(tiree, i)
                        setTiree(null)
                      }}
                    >
                      <span
                        className="mc-poignee"
                        draggable
                        title="Glisser pour changer l’ordre — la première est la plus forte"
                        onDragStart={(e) => {
                          setTiree(i)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', m.key)
                        }}
                        onDragEnd={() => setTiree(null)}
                      >
                        ⋮⋮
                      </span>
                      <button
                        className="mc-piece"
                        title="Choisir son image dans la bibliothèque"
                        aria-label={`Image de ${m.nom}`}
                        onClick={() => setImage(m.key)}
                      >
                        <Piece teinte={m.teinte} url={img?.url ?? null} taille={30} />
                      </button>
                      <input
                        id={`mc-nom-${m.key}`}
                        type="text"
                        value={m.nom}
                        onChange={(e) => change(i, { nom: e.target.value })}
                        aria-label="Nom de la monnaie"
                        spellCheck={false}
                      />
                      <input
                        id={`mc-abbr-${m.key}`}
                        className="mc-abbr"
                        type="text"
                        value={m.abbr}
                        placeholder="abr."
                        onChange={(e) => change(i, { abbr: e.target.value })}
                        aria-label="Abréviation, lue sur les prix"
                        title="Abréviation, lue sur les prix : « po », « $ »"
                        spellCheck={false}
                      />
                      <span className="mc-teintes" role="group" aria-label="Teinte de la pièce dessinée">
                        {(Object.keys(TEINTES_MONNAIE) as TeinteMonnaie[]).map((t) => (
                          <button
                            key={t}
                            aria-pressed={m.teinte === t}
                            title={img ? 'Sert quand la monnaie n’a pas d’image' : t}
                            aria-label={t}
                            style={{ ['--t' as string]: TEINTES_MONNAIE[t] }}
                            onClick={() => change(i, { teinte: t })}
                          />
                        ))}
                      </span>
                      <span className="mc-change">
                        {i === 0 ? (
                          <span className="mc-forte">la plus forte</span>
                        ) : (
                          <>
                            1 {prec.abbr || prec.nom} =
                            <input
                              id={`mc-taux-${m.key}`}
                              type="number"
                              min={1}
                              value={m.taux ?? ''}
                              placeholder="—"
                              onChange={(e) => {
                                const n = Math.round(Number(e.target.value))
                                change(i, { taux: e.target.value && n >= 1 ? n : null })
                              }}
                              aria-label={`Combien de ${m.nom} pour 1 ${prec.nom}`}
                              title="Laisser vide : pas de change, elle vit seule"
                            />
                            {m.abbr || m.nom}
                          </>
                        )}
                      </span>
                      <button
                        className="btn btn-ghost btn-sm btn-ico"
                        disabled={posees.has(m.key)}
                        title={
                          posees.has(m.key)
                            ? 'Déjà sur les fiches : elle se modifie, elle ne se supprime pas'
                            : 'Retirer'
                        }
                        aria-label={`Retirer ${m.nom}`}
                        onClick={() => poser({ ...r, liste: r.liste.filter((_, j) => j !== i) })}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mc-pied">
              <button className="btn btn-sm" onClick={ajouter}>
                <IconPlus /> Ajouter une monnaie
              </button>
              <p className="note">
                Sans image, une pièce dessinée dans sa teinte. Le change est facultatif : quand
                chaque monnaie a le sien, la bourse sait faire la monnaie et donner un total.
              </p>
            </div>
          </>
        )}
      </div>

      {enImage ? (
        <ChoixDansArbre
          titre={`Image — ${enImage.nom}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={enImage.imageItemId}
          sansLibelle="La pièce dessinée"
          onPick={(id) => {
            const i = r.liste.findIndex((m) => m.key === enImage.key)
            setImage(null)
            if (i >= 0) change(i, { imageItemId: id })
          }}
          onClose={() => setImage(null)}
        />
      ) : null}
    </section>
  )
}
