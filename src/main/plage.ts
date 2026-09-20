/**
 * Les plages d'octets, pour le serveur du portable.
 *
 * Un fichier seul dans son module, et sans aucune importation : c'est de
 * l'arithmétique, et cela s'éprouve sans monter une campagne, une base ni une
 * fenêtre — `node --experimental-strip-types` suffit.
 */

/**
 * Quelle plage d'octets le client demande.
 *
 * Trois formes, et trois seulement — celles que les lecteurs emploient :
 *
 *   `bytes=0-`       depuis le début, jusqu'au bout ;
 *   `bytes=100-200`  cet intervalle, borné à la taille du fichier ;
 *   `bytes=-500`     les cinq cents **derniers** octets — c'est par là qu'un
 *                    lecteur de PDF commence, la table des pages y est rangée.
 *
 * `null` veut dire « sers tout », et c'est aussi la réponse à un en-tête qu'on
 * ne sait pas lire : mieux vaut envoyer le fichier entier que refuser.
 * `false` veut dire « cette plage ne tient pas dans ce fichier », et se répond
 * par un 416 — un lecteur qui l'entend redemande proprement.
 */
export function plageDemandee(
  entete: string | undefined,
  taille: number
): { debut: number; fin: number } | null | false {
  if (!entete || taille <= 0) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(entete.trim())
  if (!m) return null

  let debut: number
  let fin: number
  if (m[1] === '') {
    /* Forme suffixe : `bytes=-N`. Sans N, l'en-tête ne veut rien dire. */
    const n = Number(m[2])
    if (!m[2] || !Number.isFinite(n) || n <= 0) return null
    debut = Math.max(0, taille - n)
    fin = taille - 1
  } else {
    debut = Number(m[1])
    fin = m[2] ? Math.min(Number(m[2]), taille - 1) : taille - 1
  }

  if (!Number.isFinite(debut) || !Number.isFinite(fin)) return null
  if (debut >= taille || debut > fin) return false
  return { debut, fin }
}
