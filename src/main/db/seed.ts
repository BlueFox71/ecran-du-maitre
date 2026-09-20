import type Database from 'better-sqlite3'
import { FAMILLES_LIVREES } from '@shared/types'
import type { TemplateSpec } from '@shared/types'

/* ============================================================
   Gabarits de fiche livrés avec l'application
   ============================================================ */

const COC7: TemplateSpec = {
  rollSystem: 'd100-under',
  gauges: [
    { key: 'pv', label: 'Points de vie', min: 0, max: 20, color: 'blood', maxEditable: true },
    { key: 'san', label: 'Santé mentale', min: 0, max: 99, color: 'iris', maxEditable: true },
    { key: 'chance', label: 'Chance', min: 0, max: 99, color: 'brass', maxEditable: true },
    { key: 'magie', label: 'Points de magie', min: 0, max: 30, color: 'moss', maxEditable: true }
  ],
  stats: [
    { key: 'for', label: 'FOR', derive: 'halves' },
    { key: 'con', label: 'CON', derive: 'halves' },
    { key: 'tai', label: 'TAI', derive: 'halves' },
    { key: 'dex', label: 'DEX', derive: 'halves' },
    { key: 'app', label: 'APP', derive: 'halves' },
    { key: 'edu', label: 'EDU', derive: 'halves' },
    { key: 'int', label: 'INT', derive: 'halves' },
    { key: 'pou', label: 'POU', derive: 'halves' }
  ],
  skills: [
    { key: 'anthropologie', label: 'Anthropologie' },
    { key: 'archeologie', label: 'Archéologie' },
    { key: 'bibliotheque', label: 'Bibliothèque' },
    { key: 'histoire', label: 'Histoire' },
    { key: 'occultisme', label: 'Occultisme' },
    { key: 'sciences', label: 'Sciences' },
    { key: 'medecine', label: 'Médecine' },
    { key: 'droit', label: 'Droit' },
    { key: 'comptabilite', label: 'Comptabilité' },
    { key: 'mythe', label: 'Mythe de Cthulhu' },

    { key: 'baratin', label: 'Baratin' },
    { key: 'charme', label: 'Charme' },
    { key: 'intimidation', label: 'Intimidation' },
    { key: 'persuasion', label: 'Persuasion' },
    { key: 'psychologie', label: 'Psychologie' },
    { key: 'credit', label: 'Crédit' },

    { key: 'ecouter', label: 'Écouter' },
    { key: 'trouver_objet', label: 'Trouver objet' },
    { key: 'discretion', label: 'Discrétion' },
    { key: 'pistage', label: 'Pistage' },

    { key: 'grimper', label: 'Grimper' },
    { key: 'esquive', label: 'Esquive' },
    { key: 'natation', label: 'Natation' },
    { key: 'saut', label: 'Saut' },
    { key: 'lancer', label: 'Lancer' },
    { key: 'corps_a_corps', label: 'Corps à corps' },
    { key: 'arme_de_poing', label: 'Arme de poing' },
    { key: 'fusil', label: 'Fusil / carabine' },

    { key: 'conduire', label: 'Conduire' },
    { key: 'mecanique', label: 'Mécanique' },
    { key: 'electricite', label: 'Électricité' },
    { key: 'premiers_soins', label: 'Premiers soins' },
    { key: 'crochetage', label: 'Crochetage' },
    { key: 'photographie', label: 'Photographie' },
    { key: 'survie', label: 'Survie' },
    { key: 'pilotage', label: 'Pilotage' }
  ],
  skillLimit: 8
}

const DND5: TemplateSpec = {
  rollSystem: 'd20-plus',
  gauges: [
    { key: 'pv', label: 'Points de vie', min: 0, max: 30, color: 'blood', maxEditable: true },
    { key: 'pvtemp', label: 'PV temporaires', min: 0, max: 20, color: 'moss', maxEditable: true },
    { key: 'inspiration', label: 'Inspiration', min: 0, max: 1, color: 'brass' },
    { key: 'des_de_vie', label: 'Dés de vie', min: 0, max: 5, color: 'iris', maxEditable: true }
  ],
  stats: [
    { key: 'for', label: 'FOR', derive: 'mod' },
    { key: 'dex', label: 'DEX', derive: 'mod' },
    { key: 'con', label: 'CON', derive: 'mod' },
    { key: 'int', label: 'INT', derive: 'mod' },
    { key: 'sag', label: 'SAG', derive: 'mod' },
    { key: 'cha', label: 'CHA', derive: 'mod' }
  ],
  skills: [
    { key: 'acrobaties', label: 'Acrobaties' },
    { key: 'discretion', label: 'Discrétion' },
    { key: 'escamotage', label: 'Escamotage' },
    { key: 'athletisme', label: 'Athlétisme' },
    { key: 'arcanes', label: 'Arcanes' },
    { key: 'histoire', label: 'Histoire' },
    { key: 'investigation', label: 'Investigation' },
    { key: 'nature', label: 'Nature' },
    { key: 'religion', label: 'Religion' },
    { key: 'dressage', label: 'Dressage' },
    { key: 'medecine', label: 'Médecine' },
    { key: 'perception', label: 'Perception' },
    { key: 'perspicacite', label: 'Perspicacité' },
    { key: 'survie', label: 'Survie' },
    { key: 'intimidation', label: 'Intimidation' },
    { key: 'persuasion', label: 'Persuasion' },
    { key: 'representation', label: 'Représentation' },
    { key: 'tromperie', label: 'Tromperie' }
  ],
  skillLimit: 6
}

const VIERGE: TemplateSpec = {
  rollSystem: 'd100-under',
  gauges: [{ key: 'jauge1', label: 'Jauge 1', min: 0, max: 10, color: 'neutral', maxEditable: true }],
  stats: [{ key: 'carac1', label: 'CAR 1', derive: 'none' }],
  skills: [],
  skillLimit: null
}

/**
 * La fiche que reçoit une campagne neuve : le système maison — d20 plus la
 * caractéristique — et aucune compétence. Les compétences se choisissent dans
 * le catalogue, campagne par campagne ; en proposer d'office imposerait un
 * univers à une histoire qui n'en a pas encore.
 */
const NEUVE: TemplateSpec = {
  rollSystem: 'd20-plus',
  gauges: [{ key: 'pv', label: 'Points de vie', min: 0, max: 20, color: 'blood', maxEditable: true }],
  stats: [
    { key: 'for', label: 'FOR', derive: 'mod' },
    { key: 'dex', label: 'DEX', derive: 'mod' },
    { key: 'con', label: 'CON', derive: 'mod' },
    { key: 'int', label: 'INT', derive: 'mod' },
    { key: 'sag', label: 'SAG', derive: 'mod' },
    { key: 'cha', label: 'CHA', derive: 'mod' }
  ],
  skills: [],
  skillLimit: 5
}

/* ============================================================
   Le fond de catalogue, livré avec l'application
   ============================================================ */

/** Une brique de fiche telle qu'elle entre au catalogue la première fois. */
export interface BriqueLivree {
  kind: 'stat' | 'skill' | 'gauge'
  label: string
  code?: string
  color?: string
  max?: number
}

/**
 * De quoi composer une fiche sans rien écrire le premier soir. Ce fond n'est
 * posé qu'une fois, à la création de `application.db` : une brique effacée ne
 * repousse pas au démarrage suivant. Tout ce qu'on ajoute ensuite le rejoint
 * et vaut pour toutes les campagnes.
 */
export const CATALOGUE_LIVRE: BriqueLivree[] = [
  /* Les caractéristiques se cherchent par leur nom entier — on tape « Force »,
     pas « FOR ». L'abrégé les accompagne : c'est lui que porte la fiche, et il
     retrouve l'entrée si c'est par là qu'on la cherche. */
  { kind: 'stat', code: 'FOR', label: 'Force' },
  { kind: 'stat', code: 'DEX', label: 'Dextérité' },
  { kind: 'stat', code: 'CON', label: 'Constitution' },
  { kind: 'stat', code: 'INT', label: 'Intelligence' },
  { kind: 'stat', code: 'SAG', label: 'Sagesse' },
  { kind: 'stat', code: 'CHA', label: 'Charisme' },
  { kind: 'stat', code: 'PER', label: 'Perception' },
  { kind: 'stat', code: 'VOL', label: 'Volonté' },
  { kind: 'stat', code: 'MVT', label: 'Mouvement' },
  { kind: 'stat', code: 'TAI', label: 'Taille' },
  { kind: 'stat', code: 'APP', label: 'Apparence' },
  { kind: 'stat', code: 'EDU', label: 'Éducation' },
  { kind: 'stat', code: 'POU', label: 'Pouvoir' },

  ...uniques([
    ...COC7.skills.map((x) => ({ kind: 'skill' as const, label: x.label })),
    ...DND5.skills.map((x) => ({ kind: 'skill' as const, label: x.label }))
  ]),

  { kind: 'gauge', label: 'Points de vie', color: 'blood', max: 20 },
  { kind: 'gauge', label: 'PV temporaires', color: 'moss', max: 10 },
  { kind: 'gauge', label: 'Santé mentale', color: 'iris', max: 99 },
  { kind: 'gauge', label: 'Points de magie', color: 'moss', max: 30 },
  { kind: 'gauge', label: 'Chance', color: 'brass', max: 99 },
  { kind: 'gauge', label: 'Inspiration', color: 'brass', max: 1 },
  { kind: 'gauge', label: 'Dés de vie', color: 'iris', max: 5 },
  { kind: 'gauge', label: 'Souffle', color: 'azur', max: 6 }
]

/** Deux gabarits peuvent nommer la même chose ; le catalogue ne la garde qu'une fois. */
function uniques(briques: BriqueLivree[]): BriqueLivree[] {
  const vus = new Set<string>()
  return briques.filter((b) => {
    const k = `${b.kind}/${b.label.toLowerCase()}`
    if (vus.has(k)) return false
    vus.add(k)
    return true
  })
}

/** Les fiches complètes proposées au départ d'une campagne. */
export const MODELES_LIVRES: { name: string; spec: TemplateSpec }[] = [
  { name: 'Système maison — d20 + caractéristique', spec: NEUVE },
  { name: "L'Appel de Cthulhu 7e", spec: COC7 },
  { name: 'D&D 5e', spec: DND5 },
  { name: 'Fiche vierge', spec: VIERGE }
]

/* ============================================================
   Installation initiale
   ============================================================ */

/**
 * Un projet neuf : les gabarits de fiche, une campagne au nom du dossier, et
 * de quoi commencer à jouer. Rien d'autre — la bibliothèque, elle, naît du
 * contenu du dossier.
 */
export function seedProject(db: Database.Database, nom: string): void {
  db.transaction(() => {
    const tpl = db.prepare(
      `INSERT INTO sheet_template (campaign_id, name, spec, builtin) VALUES (NULL, ?, ?, 1)`
    )
    tpl.run("L'Appel de Cthulhu 7e", JSON.stringify(COC7))
    tpl.run('D&D 5e', JSON.stringify(DND5))
    tpl.run('Vierge', JSON.stringify(VIERGE))

    const camp = db
      .prepare(`INSERT INTO campaign (name, system, active) VALUES (?, ?, 1)`)
      .run(nom, null)
    const cid = Number(camp.lastInsertRowid)

    /* La fiche de la campagne — une seule, partagée par tous ses personnages. */
    const fiche = db
      .prepare(`INSERT INTO sheet_template (campaign_id, name, spec, builtin) VALUES (?, ?, ?, 0)`)
      .run(cid, `Fiche de ${nom}`, JSON.stringify(NEUVE))
    db.prepare(`UPDATE campaign SET sheet_template_id = ? WHERE id = ?`).run(
      Number(fiche.lastInsertRowid),
      cid
    )

    /* Les rayons de la réserve. Une campagne neuve les a d'emblée : on ne
       demande pas au MJ d'inventer huit familles avant de décrire sa première
       lanterne. Il les renomme ensuite, ou les retire. */
    const fam = db.prepare(
      `INSERT INTO objet_famille (campaign_id, nom, teinte, glyphe, ord, builtin)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    FAMILLES_LIVREES.forEach((f, i) => fam.run(cid, f.nom, f.teinte, f.glyphe, i))

    const chap = db.prepare(`INSERT INTO chapter (campaign_id, ord, title) VALUES (?, ?, ?)`)
    ;['I — Ouverture', 'II — Enquête', 'III — Révélation'].forEach((t, i) => chap.run(cid, i, t))

    db.prepare(`INSERT INTO game_session (campaign_id, label, active) VALUES (?, ?, 1)`).run(
      cid,
      'Séance 1'
    )
  })()
  console.log(`[db] projet « ${nom} » installé`)
}
