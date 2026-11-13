/* Banc d'essai du rendu : `npx electron outils/atelier/apercu/main.cjs <sortie.png>` */
const { app, BrowserWindow } = require('electron')
const { buildSync } = require('esbuild')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const racine = join(__dirname, '..', '..', '..')
const pack = join(racine, 'resources', 'atelier')
const js = buildSync({
  entryPoints: [join(__dirname, 'scene.ts')], bundle: true, write: false, format: 'esm', target: 'es2022',
  define: { CATALOGUE: readFileSync(join(pack, 'catalogue.json'), 'utf8'), PACK: JSON.stringify(pathToFileURL(pack).href) }
}).outputFiles[0].text
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } })
  await w.loadURL('data:text/html,<body style="margin:0;background:#000"></body>')
  await w.webContents.executeJavaScript(`(async()=>{${js.replace(/^export \{\};?$/m, '')}})()`).catch(e => { console.error(e); })
  const url = await w.webContents.executeJavaScript('new Promise(r=>{const t=()=>window.fini?r(window.fini):setTimeout(t,100);t()})')
  writeFileSync(process.argv[process.argv.length - 1], Buffer.from(url.split(',')[1], 'base64'))
  console.log('ok')
  app.quit()
})
