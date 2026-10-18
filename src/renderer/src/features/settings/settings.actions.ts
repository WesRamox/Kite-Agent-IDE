import { useEffect } from 'react'
import { useModalStore } from '../../stores/modal.store'
import { useSettingsStore } from '../../stores/settings.store'
import { applyTerminalFontSize } from '../terminal/terminal.actions'

// Abre as configurações numa janela sobreposta.
export function openSettings(): void {
  useModalStore.getState().show('settings')
}

// Carrega as configurações ao abrir o app e aplica a fonte nova aos terminais já abertos (o
// editor lê do store e se atualiza sozinho).
export function useSettingsSync(): void {
  useEffect(() => {
    void useSettingsStore.getState().load()
    return useSettingsStore.subscribe((state, prev) => {
      const size = state.settings.terminalFontSize
      if (size === prev.settings.terminalFontSize) return
      applyTerminalFontSize(size)
    })
  }, [])
}
