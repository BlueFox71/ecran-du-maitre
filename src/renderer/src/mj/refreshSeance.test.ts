import { expect, it, vi } from 'vitest'
import { useStore } from './store'

it('changer de séance recharge aussi la pochette', async () => {
  const rien = async (): Promise<void> => {}
  const refreshPochette = vi.fn(rien)
  useStore.setState({
    refreshTimeline: rien,
    refreshRolls: rien,
    refreshPlaces: rien,
    refreshCharacters: rien,
    refreshObjets: rien,
    refreshPochette
  })
  await useStore.getState().refreshSeance()
  expect(refreshPochette).toHaveBeenCalled()
})
