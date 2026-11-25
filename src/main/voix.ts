/**
 * La voix de la Spirit Box : Windows prononce le texte du MJ (System.Speech,
 * hors ligne, avec les voix installées) et l'écrit dans un fichier WAV, que
 * l'écran du MJ transforme ensuite (radio, grave, hachée, écho).
 *
 * Le texte voyage encodé (base64 d'un JSON UTF-8) dans une variable
 * d'environnement : il n'entre jamais dans la ligne de commande, et un
 * caractère tapé ne peut rien y exécuter. Le script, lui, est fixe.
 */
import { spawn } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface VoixInstallee {
  nom: string
  langue: string
  genre: string
}

const SCRIPT_VOIX = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
  $v = $_.VoiceInfo
  [pscustomobject]@{ nom = $v.Name; langue = $v.Culture.Name; genre = [string]$v.Gender }
} | ConvertTo-Json -Compress
`

const SCRIPT_PARLER = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$req = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:SPIRIT_REQ)) | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($req.voix) { $s.SelectVoice([string]$req.voix) }
$s.Rate = [int]$req.debit
$s.SetOutputToWaveFile([string]$req.fichier)
$s.Speak([string]$req.texte)
$s.Dispose()
`

function powershell(script: string, env: Record<string, string> = {}): Promise<string> {
  return new Promise((ok, ko) => {
    /* Le script (fixe) part d'un bloc en -EncodedCommand : lu ligne à ligne sur
       l'entrée standard, PowerShell laisse en plan les blocs sur plusieurs lignes. */
    const code = Buffer.from(script, 'utf16le').toString('base64')
    const p = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', code],
      { windowsHide: true, env: { ...process.env, ...env } }
    )
    let sortie = ''
    let erreur = ''
    p.stdout.on('data', (d) => (sortie += d.toString('utf8')))
    p.stderr.on('data', (d) => (erreur += d.toString('utf8')))
    p.on('error', ko)
    p.on('close', (code) => (code === 0 ? ok(sortie) : ko(new Error(erreur.trim() || `powershell ${code}`))))
    p.stdin.end()
  })
}

let voixEnCache: VoixInstallee[] | null = null

/** Les voix installées sur ce Windows (lues une fois). */
export async function voixInstallees(): Promise<VoixInstallee[]> {
  if (voixEnCache) return voixEnCache
  try {
    const brut = (await powershell(SCRIPT_VOIX)).trim()
    const v = brut ? (JSON.parse(brut) as VoixInstallee | VoixInstallee[]) : []
    voixEnCache = Array.isArray(v) ? v : [v]
  } catch (e) {
    console.error('[spirit box] voix illisibles', e)
    voixEnCache = []
  }
  return voixEnCache
}

let numero = 0

/**
 * Le texte prononcé, en WAV. `debit` de −10 (lent) à 10 (rapide), comme
 * System.Speech. Rend les octets du fichier, effacé aussitôt lu.
 */
export async function parler(texte: string, voix: string | null, debit: number): Promise<Uint8Array> {
  const propre = String(texte ?? '').slice(0, 500)
  if (!propre.trim()) throw new Error('Rien à dire')
  const fichier = join(tmpdir(), `spirit-box-${process.pid}-${++numero}.wav`)
  const req = {
    texte: propre,
    voix: voix || null,
    debit: Math.max(-10, Math.min(10, Math.round(Number(debit) || 0))),
    fichier
  }
  const SPIRIT_REQ = Buffer.from(JSON.stringify(req), 'utf8').toString('base64')
  try {
    await powershell(SCRIPT_PARLER, { SPIRIT_REQ })
    return new Uint8Array(readFileSync(fichier))
  } finally {
    rmSync(fichier, { force: true })
  }
}
