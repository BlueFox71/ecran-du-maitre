/* Les tests de la base passent par le Node d'Electron : better-sqlite3 est
   compilé pour lui (npm run rebuild), pas pour le Node du système. */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electron = require('electron')
const vitest = require.resolve('vitest/vitest.mjs')
const r = spawnSync(electron, [vitest, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(r.status ?? 1)
