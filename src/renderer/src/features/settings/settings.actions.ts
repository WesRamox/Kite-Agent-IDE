import { useEffect } from 'react'
import { getDockApi } from '../../lib/dock'
import { useSettingsStore } from '../../stores/settings.store'
import { getSession, sessionIds } from '../terminal/terminals'

export const SETTINGS_COMPONENT = 'settings'
export const SETTINGS_TAB_COMPONENT = 'settings-tab'
const SETTINGS_PANEL_ID = 'settings'

export function isSettingsPanel(id: string): boolean {
  return id === SETTINGS_PANEL_ID
}

// Abre (ou foca) a página de configurações na área principal.
export function openSettings(): void {
  const dock = getDockApi()
  if (!dock) return
  const existing = dock.getPanel(SETTINGS_PANEL_ID)
  if (existing) {
    existing.api.setActive()
    return
  }
  dock.addPanel({
    id: SETTINGS_PANEL_ID,
    component: SETTINGS_COMPONENT,
    tabComponent: SETTINGS_TAB_COMPONENT,
    title: 'Configurações',
  })
}

// Carrega as configurações ao abrir o app e aplica a fonte nova aos terminais já abertos (o
// editor lê do store e se atualiza sozinho).
export function useSettingsSync(): void {
  useEffect(() => {
    void useSettingsStore.getState().load()
    return useSettingsStore.subscribe((state, prev) => {
      const size = state.settings.terminalFontSize
      if (size === prev.settings.terminalFontSize) return
      for (const id of sessionIds()) getSession(id)?.setFontSize(size)
    })
  }, [])
}
