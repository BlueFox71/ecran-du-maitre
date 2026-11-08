/**
 * Ranger les adresses du poste, de la plus joignable par un téléphone à la
 * moins joignable.
 *
 * Le piège : sur un PC qui fait tourner Hyper-V, la carte du **vrai** réseau de
 * la maison peut s'appeler « vEthernet (MonSwitch) » — un commutateur externe
 * ponté sur la carte physique. L'écarter comme « virtuelle » laissait passer
 * devant elle le « Default Switch », réseau interne qu'aucun téléphone ne
 * joint, et le QR envoyait la table dans le vide.
 *
 * D'où des rangs plutôt qu'un tri en deux :
 *  0. le Wi-Fi d'une vraie carte ;
 *  1. les autres vraies cartes ;
 *  2. une carte au nom virtuel, mais qui n'est pas un réseau interne connu —
 *     typiquement le commutateur externe d'Hyper-V ;
 *  3. les réseaux internes connus (Default Switch, WSL, Docker, VirtualBox…) ;
 *  4. les adresses 169.254, qu'une carte se donne faute de réseau.
 */
export type Candidate = { nom: string; ip: string }

const VIRTUELLE = /(virtual|vmware|vethernet|wsl|docker|loopback|hyper-v|bluetooth)/i
const INTERNE = /(default switch|wsl|docker|virtualbox|vboxnet|vmnet|vmware|loopback|bluetooth)/i
const WIFI = /(wi-?fi|wlan|sans fil|wireless)/i

function rang(c: Candidate): number {
  if (c.ip.startsWith('169.254.')) return 4
  if (!VIRTUELLE.test(c.nom)) return WIFI.test(c.nom) ? 0 : 1
  return INTERNE.test(c.nom) ? 3 : 2
}

/** À rang égal, les plages de box d'abord : 192.168 avant 10, avant 172.16–31. */
function plage(ip: string): number {
  if (ip.startsWith('192.168.')) return 0
  if (ip.startsWith('10.')) return 1
  return 2
}

export function classerAdresses(candidates: Candidate[]): Candidate[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rang(a.c) - rang(b.c) || plage(a.c.ip) - plage(b.c.ip) || a.i - b.i)
    .map((x) => x.c)
}
