import { describe, expect, it } from 'vitest'
import { classerAdresses } from './adresses'

const ips = (l: { ip: string }[]): string[] => l.map((c) => c.ip)

describe('classerAdresses', () => {
  it('préfère le commutateur externe Hyper-V au Default Switch et au 169.254', () => {
    /* Le poste du MJ, tel que Node le voit : le Default Switch arrive en premier. */
    const l = classerAdresses([
      { nom: 'vEthernet (Default Switch)', ip: '172.23.96.1' },
      { nom: 'vEthernet (Reseau-HomeAssistant)', ip: '192.168.1.67' },
      { nom: 'Connexion réseau Bluetooth', ip: '169.254.104.156' }
    ])
    expect(ips(l)).toEqual(['192.168.1.67', '172.23.96.1', '169.254.104.156'])
  })

  it('garde le Wi-Fi d’une vraie carte en tête', () => {
    const l = classerAdresses([
      { nom: 'Ethernet', ip: '10.0.0.5' },
      { nom: 'vEthernet (Externe)', ip: '192.168.1.20' },
      { nom: 'Wi-Fi', ip: '192.168.1.10' }
    ])
    expect(ips(l)).toEqual(['192.168.1.10', '10.0.0.5', '192.168.1.20'])
  })

  it('relègue WSL et Docker derrière une carte virtuelle inconnue', () => {
    const l = classerAdresses([
      { nom: 'vEthernet (WSL)', ip: '172.20.0.1' },
      { nom: 'vEthernet (Docker)', ip: '10.0.75.1' },
      { nom: 'vEthernet (LAN)', ip: '192.168.0.12' }
    ])
    expect(ips(l)[0]).toBe('192.168.0.12')
  })
})
