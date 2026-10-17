import type { Result } from '@shared/types'
import { attempt } from '../lib/ipc'
import { closeAllNow, resolveAllDirty } from '../features/editor/editor.actions'
import { useExplorerStore } from '../features/explorer/explorer.store'
import { useQuickOpenStore } from '../features/quick-open/quick-open.store'
import {
  closeAllTerminals,
  restoreTerminalSessions,
  saveTerminalSessions,
} from '../features/terminal/terminal.actions'
import { loadTasks } from '../features/tasks/tasks.actions'
import { useTasksStore } from '../features/tasks/tasks.store'
import { useContextStore } from '../stores/context.store'
import { useWorkspaceStore } from '../stores/workspace.store'

async function switchWorkspace(open: () => Promise<Result<string | null>>): Promise<void> {
  if (!(await resolveAllDirty())) return
  // Guarda os terminais do workspace atual antes que o main o feche.
  const previous = useWorkspaceStore.getState().root
  if (previous) await saveTerminalSessions(previous)
  const root = await attempt(open(), 'Erro ao abrir a pasta')
  const workspace = useWorkspaceStore.getState()
  void workspace.loadRecent()
  if (!root) return

  closeAllNow()
  closeAllTerminals()
  // Contextos das tarefas do workspace anterior somem junto.
  useContextStore.getState().reset()
  useTasksStore.getState().reset()
  useQuickOpenStore.getState().invalidate()
  const explorer = useExplorerStore.getState()
  explorer.reset()
  workspace.setRoot(root)
  // Observa antes de carregar: nada criado entre a leitura e o início do watcher se perde.
  await attempt(window.api.fs.watch(root), 'Erro ao observar a pasta')
  await attempt(window.api.git.watch(root), 'Erro ao observar o repositório')
  await explorer.load(root)
  await restoreTerminalSessions(root)
  await loadTasks(root, { fromOpen: true })
}

export function openFolder(): Promise<void> {
  return switchWorkspace(() => window.api.workspace.openFolderDialog())
}

export function openRecent(path: string): Promise<void> {
  return switchWorkspace(() => window.api.workspace.openRecent(path))
}

export function openWorktree(path: string): Promise<void> {
  return switchWorkspace(() => window.api.workspace.openWorktree(path))
}
