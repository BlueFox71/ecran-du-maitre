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
  if (ancienne) places.recalerApresRognage(placeId, ancienne, neuf.id, cadre ?? CADRE_IDENTITE)
  else db.prepare(`UPDATE place SET map_item_id = ? WHERE id = ?`).run(neuf.id, placeId)

  /* L'échelle se lit dans la construction : on sait combien mesure une case.
     Le recalage vient d'y toucher ; c'est celle-ci qui fait foi. */
  db.prepare(`UPDATE place SET echelle = ? WHERE id = ?`).run(c.largeur * c.metresParCase, placeId)

  setConstruction(placeId, c)
  synchroniserCalque(placeId, deriverCalque(c))

  /* L'ancienne image n'était qu'un tirage de la construction : on ne la garde
     que si elle n'est pas de nous. */
  if (ancienItem?.relPath && ancienItem.id !== neuf.id && ancienItem.relPath.includes(DOSSIER_PLANS_BATIS))
    try {
      fsLib.effacerDeLApp(ancienItem.relPath)
    } catch {
      /* elle restera dans le dossier de l'app : sans conséquence */
    }

  return { place: places.getPlace(placeId)!, ancienne, neuve: neuf.id }
}
