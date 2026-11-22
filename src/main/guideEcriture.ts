/**
 * Poser le guide d'écriture dans le dossier de l'app d'une séance
 * (`.ecran-du-maitre/<séance>/GUIDE-ECRITURE-SEANCE.md`).
 *
 * Il est réécrit chaque fois qu'on entre dans la séance : il suit ainsi son
 * nom, son dossier, la fiche de la campagne et la version du logiciel. On
 * n'écrit que s'il a changé, pour ne pas réveiller la surveillance du dossier
 * pour rien. Un `.md` n'est pas un fichier que la bibliothèque range.
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getDb, isDbOpen } from './db'
import { campaignSheet } from './db/repos/characters'
import { absOf, campaignRoot, insideRoot } from './library'
import { dossierDeLApp } from '@shared/dossierDeLApp'
import { NOM_GUIDE, texteGuide } from '@shared/guideEcriture'

export function ecrireGuide(sessionId: number): void {
  try {
    const racine = campaignRoot()
    if (!isDbOpen() || !racine) return
    const db = getDb()
    const s = db
      .prepare(`SELECT label, folder_rel AS base, ord, campaign_id AS cid FROM game_session WHERE id = ?`)
      .get(sessionId) as { label: string; base: string | null; ord: number; cid: number } | undefined
    if (!s) return
    /* Le modèle : la séance d'avant qui a son propre dossier. */
    const avant = db
      .prepare(
        `SELECT folder_rel AS base FROM game_session
          WHERE campaign_id = ? AND folder_rel IS NOT NULL AND folder_rel <> COALESCE(?, '')
            AND (ord < ? OR (ord = ? AND id < ?))
          ORDER BY ord DESC, id DESC LIMIT 1`
      )
      .get(s.cid, s.base, s.ord, s.ord, sessionId) as { base: string } | undefined
    const spec = campaignSheet().spec
    const texte = texteGuide({
      seance: s.label,
      base: s.base,
      racine,
      modele: avant?.base ?? null,
      version: app.getVersion(),
      fiche: {
        stats: spec.stats.map((x) => x.label),
        jauges: spec.gauges.map((x) => x.label),
        competences: spec.skills.map((x) => x.label)
      }
    })
    const abs = absOf(`${dossierDeLApp(s.base, '')}/${NOM_GUIDE}`.replace(/\/+/g, '/'))
    if (!insideRoot(abs)) return
    if (existsSync(abs) && readFileSync(abs, 'utf8') === texte) return
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, texte, 'utf8')
  } catch (e) {
    console.error('[guide] écriture impossible :', e)
  }
}
