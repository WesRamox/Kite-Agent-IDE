import type { Task, TaskChangesRepo } from '@shared/types'
import { useShallow } from 'zustand/react/shallow'
import { useIpcQuery } from '../../lib/use-ipc-query'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useTasksStore } from './tasks.store'

// Espera o watcher assentar: um commit gera vários eventos seguidos.
const REFRESH_MS = 300

// Arquivos alterados de cada worktree da tarefa contra a base. Recarrega quando o status git de
// alguma worktree da tarefa muda (o watcher do .git dispara).
export function useTaskChanges(task: Task): TaskChangesRepo[] | null {
  const root = useWorkspaceStore((s) => s.root)
  const signal = useTasksStore(useShallow((s) => task.worktrees.map((w) => s.status[w.path])))
  const taskId = task.id
  return useIpcQuery(
    () => (root ? window.api.review.changes(root, taskId) : null),
    [root, taskId],
    { delayMs: REFRESH_MS, identity: taskId, refresh: signal },
  ).data
}
