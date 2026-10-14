// Pose le rapport de mise à jour (RELEASE_NOTES.md) comme notes de la release GitHub
// `v<version>`. C'est ce texte que Le Grenier affiche dans la section « Actualités »
// de la fiche du projet ; une release sans notes n'y apparaît pas.
//
//   GH_TOKEN=<jeton écriture> node scripts/publish-notes.mjs
//
// Le fichier doit commencer par `<!-- version: X.Y.Z -->`, égal à la version de
// package.json : c'est le garde-fou contre un rapport oublié, resté celui de la
// version précédente. Le marqueur est retiré du texte publié.
//
// Fonctionne aussi sur une release encore en brouillon (electron-builder les crée
// ainsi par défaut) : on la retrouve par son tag dans la liste complète.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const NOTES_FILE = 'RELEASE_NOTES.md'

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token) fail('GH_TOKEN absent : jeton GitHub en écriture requis.')

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const tag = `v${version}`

let raw
try {
  raw = readFileSync(NOTES_FILE, 'utf8')
} catch {
  fail(`${NOTES_FILE} introuvable : rédige le rapport de la version ${version}.`)
}
const marker = raw.match(/^\s*<!--\s*version:\s*([^\s]+)\s*-->\s*/)
if (!marker) fail(`${NOTES_FILE} doit commencer par <!-- version: ${version} -->.`)
if (marker[1] !== version) {
  fail(`${NOTES_FILE} est le rapport de la ${marker[1]}, pas de la ${version} : mets-le à jour.`)
}
const body = raw.slice(marker[0].length).trim()
if (!body) fail(`${NOTES_FILE} est vide.`)

// owner/repo depuis l'origine git (https ou ssh).
const origin = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
const repo = origin.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1]
if (!repo) fail(`Origine git non reconnue : ${origin}`)

const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'publish-notes',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

const res = await api('/releases?per_page=30')
if (!res.ok) fail(`Lecture des releases impossible (HTTP ${res.status}).`)
const release = (await res.json()).find((r) => r.tag_name === tag)
if (!release) fail(`Aucune release ${tag} sur ${repo} : publie-la d'abord.`)

const patch = await api(`/releases/${release.id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
if (!patch.ok) fail(`Mise à jour de la release impossible (HTTP ${patch.status}).`)
console.log(`✔ Rapport posé sur ${repo} ${tag}${release.draft ? ' (brouillon)' : ''}.`)
