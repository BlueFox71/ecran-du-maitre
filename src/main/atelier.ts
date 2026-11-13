/**
 * L'atelier des lieux, côté processus principal : créer un lieu bâti,
 * enregistrer sa construction, et faire en sorte que le reste de
 * l'application n'y voie qu'un plan ordinaire.
 *
 * Le renderer dessine la construction et envoie l'image ; ici, on la range,
 * on la donne au lieu, et on dérive le calque. Ce qui était posé sur le lieu
 * — pions, lampes, sons, repères, pièces nommées — se recale exactement comme
 * après un rognage : c'est le même calcul.
 */
import * as places from './db/repos/places'
import * as lib from './db/repos/library'
import * as fsLib from './library'
import { getDb } from './db'
import { getConstruction, setConstruction, synchroniserCalque } from './db/repos/construction'
import {
  constructionVide,
  deriverCalque,
  lireConstruction,
  type Cadre,
  type Construction
} from '@shared/atelier'
import { dossierDeLApp } from '@shared/dossierDeLApp'
import type { Place } from '@shared/types'

/** Où vont les images des plans bâtis, dans le dossier de l'app. */
export const DOSSIER_PLANS_BATIS = 'Plans construits'

export function creer(nom: string, parentId: number | null): Place {
  const p = places.upsertPlace({ name: nom.trim() || 'Lieu construit', parentId })
  setConstruction(p.id, constructionVide())
  return places.getPlace(p.id)!
}

/** Bâtir un lieu qui existe déjà — à condition qu'il n'ait pas encore d'image. */
export function construire(placeId: number): Place {
  const p = places.getPlace(placeId)
  if (!p) throw new Error('Lieu introuvable')
  if (p.construit) return p
  if (p.mapItemId) throw new Error('Ce lieu a déjà une image : l’atelier part de zéro')
  setConstruction(placeId, constructionVide())
  return places.getPlace(placeId)!
}

export function de(placeId: number): Construction | null {
  return getConstruction(placeId)
}

const CADRE_IDENTITE: Cadre = { x: 0, y: 0, w: 1, h: 1 }

/**
 * Ce document sert-il encore quelque part ? Une copie du lieu dans une autre
 * séance, une image attachée, un moment, la Pochette… On le demande à la base
 * elle-même : toute colonne qui déclare pointer vers `item`, plus les deux
 * colonnes de lieu qui ne le déclarent pas.
 */
function itemEncoreUtilise(itemId: number): boolean {
  const db = getDb()
  const n = (sql: string, ...v: number[]): number => (db.prepare(sql).get(...v) as { n: number }).n
  if (n(`SELECT COUNT(*) AS n FROM place WHERE map_item_id = ? OR ambience_item_id = ?`, itemId, itemId)) return true
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
  for (const { name } of tables) {
    const fks = db.prepare(`PRAGMA foreign_key_list("${name}")`).all() as { table: string; from: string }[]
    for (const fk of fks)
      if (fk.table === 'item' && n(`SELECT COUNT(*) AS n FROM "${name}" WHERE "${fk.from}" = ?`, itemId)) return true
  }
  return false
}

/**
 * Enregistrer : l'image devient la carte, la construction est retenue, le
 * calque en dérive.
 *
 * `cadre` dit où l'ancienne carte se place dans la nouvelle quand le terrain
 * a grandi depuis le dernier enregistrement ; sans lui, la carte garde son
 * cadrage. Rend l'ancienne et la nouvelle image, pour que l'appelant prévienne
 * l'écran des joueurs.
 */
export function enregistrer(
  placeId: number,
  brut: unknown,
  png: Uint8Array,
  cadre?: Cadre | null
): { place: Place; ancienne: number | null; neuve: number } {
  const p = places.getPlace(placeId)
  if (!p) throw new Error('Lieu introuvable')
  if (!p.construit) throw new Error('Ce lieu ne sort pas de l’atelier')
  const c = lireConstruction(brut)

  const rel = fsLib.ecrireImageDeLApp(
    dossierDeLApp(null, DOSSIER_PLANS_BATIS),
    `${p.name} (construit)`,
    png
  )
  const neuf = lib.itemByPath(rel)
  if (!neuf) throw new Error('Le plan enregistré n’a pas été retrouvé')

  const ancienne = p.mapItemId
  const ancienItem = ancienne ? lib.getItem(ancienne) : null
  const db = getDb()
  /* Tout ou rien : un recalage écrit sans la construction qui va avec serait
     rejoué au prochain essai, et tout ce qui est posé se décalerait deux fois. */
  try {
    db.transaction(() => {
      if (ancienne) places.recalerApresRognage(placeId, ancienne, neuf.id, cadre ?? CADRE_IDENTITE)
      else db.prepare(`UPDATE place SET map_item_id = ? WHERE id = ?`).run(neuf.id, placeId)

      /* L'échelle se lit dans la construction : on sait combien mesure une case.
         Le recalage vient d'y toucher ; c'est celle-ci qui fait foi. */
      db.prepare(`UPDATE place SET echelle = ? WHERE id = ?`).run(c.largeur * c.metresParCase, placeId)

      setConstruction(placeId, c)
      synchroniserCalque(placeId, deriverCalque(c))
    })()
  } catch (e) {
    /* La nouvelle image ne sert à rien : on ne la laisse pas traîner. */
    try {
      fsLib.effacerDeLApp(rel)
    } catch {
      /* sans conséquence */
    }
    throw e
  }

  /* L'ancienne image n'était qu'un tirage de la construction : on ne la garde
     que si elle n'est pas de nous. */
  if (
    ancienItem?.relPath &&
    ancienItem.id !== neuf.id &&
    ancienItem.relPath.includes(DOSSIER_PLANS_BATIS) &&
    !itemEncoreUtilise(ancienItem.id)
  )
    try {
      fsLib.effacerDeLApp(ancienItem.relPath)
    } catch {
      /* elle restera dans le dossier de l'app : sans conséquence */
    }

  return { place: places.getPlace(placeId)!, ancienne, neuve: neuf.id }
}
