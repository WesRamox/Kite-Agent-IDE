import { useEffect } from 'react'
import { handleExternalChange, handleExternalDelete } from '../features/editor/editor.actions'
import { useExplorerStore } from '../features/explorer/explorer.store'
import { useQuickOpenStore } from '../features/quick-open/quick-open.store'
import { basename, dirname } from '../lib/paths'
import { useTasksStore } from '../features/tasks/tasks.store'
import { useWorkspaceStore } from '../stores/workspace.store'

// Reage às mudanças no disco vindas do watcher do main.
export function useFsEvents(): void {
  useEffect(
    () =>
      window.api.fs.onChanged(({ root, events }) => {
        // A pasta aberta e as worktrees das tarefas abertas.
        if (
          root !== useWorkspaceStore.getState().root &&
          !(root in useTasksStore.getState().status)
        )
          return
        const explorer = useExplorerStore.getState()
        const dirs = new Set<string>()
        let structural = false
        for (const e of events) {
          // Regras de ignore mudaram: tudo que está carregado pode mudar de visibilidade.
          if (basename(e.path) === '.gitignore') {
            structural = true
            Object.keys(explorer.children).forEach((d) => dirs.add(d))
          }
          if (e.type !== 'update') {
            structural = true
            dirs.add(dirname(e.path))
          }
          if (e.type === 'delete') {
            explorer.forget(e.path)
            handleExternalDelete(e.path)
          } else {
            void handleExternalChange(e.path)
          }
        }
        if (structural) useQuickOpenStore.getState().invalidate()
        if (dirs.size > 0) void explorer.refresh(dirs)
      }),
    [],
  )
}
