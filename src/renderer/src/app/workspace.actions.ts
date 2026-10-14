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
  useQuickOpenStore.getState().invalidate()
  const explorer = useExplorerStore.getState()
  explorer.reset()
  workspace.setRoot(root)
  await explorer.load(root)
  await attempt(window.api.fs.watch(root), 'Erro ao observar a pasta')
  await restoreTerminalSessions(root)
}

export function openFolder(): Promise<void> {
  return switchWorkspace(() => window.api.workspace.openFolderDialog())
}

export function openRecent(path: string): Promise<void> {
  return switchWorkspace(() => window.api.workspace.openRecent(path))
}
