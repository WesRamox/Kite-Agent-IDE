import { useEffect } from 'react'
import { closeActive, saveActive } from '../features/editor/editor.actions'
import { useQuickOpenStore } from '../features/quick-open/quick-open.store'
import { useWorkspaceStore } from '../stores/workspace.store'

const isMac = navigator.userAgent.includes('Mac')

// Atalhos globais. Escuta na fase de captura para agir antes do Monaco.
export function useKeybindings(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod || e.altKey) return
      const key = e.key.toLowerCase()
      let handled = true
      if (key === 's' && !e.shiftKey) void saveActive()
      else if (key === 'p' && !e.shiftKey) {
        if (useWorkspaceStore.getState().root) useQuickOpenStore.getState().show()
      } else if (key === 'w' && !e.shiftKey) void closeActive()
      else handled = false
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
