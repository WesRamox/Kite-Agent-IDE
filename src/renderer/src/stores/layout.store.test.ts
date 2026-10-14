import { beforeEach, describe, expect, it } from 'vitest'
import { useLayoutStore } from './layout.store'

describe('layout store', () => {
  beforeEach(() => useLayoutStore.setState({ activeView: 'explorer', sidebarVisible: true }))

  it('troca a view ativa', () => {
    useLayoutStore.getState().selectView('git')
    expect(useLayoutStore.getState()).toMatchObject({ activeView: 'git', sidebarVisible: true })
  })

  it('recolhe e reabre a sidebar ao clicar na view ativa', () => {
    useLayoutStore.getState().selectView('explorer')
    expect(useLayoutStore.getState().sidebarVisible).toBe(false)
    useLayoutStore.getState().selectView('explorer')
    expect(useLayoutStore.getState().sidebarVisible).toBe(true)
  })
})
