import { useEffect } from 'react'
import { jumpToNextWaiting } from '../features/agents/attention.actions'
import { closeActive, saveActive } from '../features/editor/editor.actions'
import { useQuickOpenStore } from '../features/quick-open/quick-open.store'
import { focusOrCreateTerminal, openTerminal } from '../features/terminal/terminal.actions'
import { isMac } from '../lib/platform'
import { useWorkspaceStore } from '../stores/workspace.store'

function inTerminal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.xterm') !== null
}

// Atalhos globais. Escuta na fase de captura para agir antes do Monaco e do xterm.
export function useKeybindings(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod || e.altKey) return
      const key = e.key.toLowerCase()
      // No Linux/Windows, Ctrl+S e Ctrl+W são do shell (XOFF, apagar palavra) quando o foco
      // está no terminal. No macOS os atalhos usam Cmd e não conflitam.
      const shellOwns = !isMac && inTerminal(e.target)
      let handled = true
      if (e.code === 'Backquote') {
        if (e.shiftKey) openTerminal()
        else focusOrCreateTerminal()
      } else if (key === 's' && !e.shiftKey && !shellOwns) void saveActive()
      else if (key === 'p' && !e.shiftKey) {
        if (useWorkspaceStore.getState().root) useQuickOpenStore.getState().show()
      } else if (key === 'w' && !e.shiftKey && !shellOwns) void closeActive()
      // Ctrl+J no terminal é quebra de linha (inclusive no prompt do Claude Code): lá dentro,
      // use Ctrl+Shift+J.
      else if (key === 'j' && (e.shiftKey || !shellOwns)) jumpToNextWaiting()
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
