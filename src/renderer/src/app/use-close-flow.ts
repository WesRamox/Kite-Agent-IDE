import { useEffect } from 'react'
import { resolveAllDirty } from '../features/editor/editor.actions'
import { saveTerminalSessions } from '../features/terminal/terminal.actions'
import { useWorkspaceStore } from '../stores/workspace.store'

// O main pede para fechar: pergunta sobre arquivos não salvos, salva os terminais e só então
// confirma. Se o usuário cancelar, nada acontece e a janela continua aberta.
export function useCloseFlow(): void {
  useEffect(() => {
    let busy = false
    return window.api.app.onCloseRequested(() => {
      if (busy) return
      busy = true
      void (async () => {
        try {
          if (!(await resolveAllDirty())) return
          const root = useWorkspaceStore.getState().root
          if (root) await saveTerminalSessions(root)
          await window.api.app.confirmClose()
        } finally {
          busy = false
        }
      })()
    })
  }, [])
}
