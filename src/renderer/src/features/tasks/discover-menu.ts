import type { TFunction } from '@shared/i18n'
import type { Task, TaskWorktree } from '@shared/types'
import type { MenuItem } from '../../components/ContextMenu'
import { ignoreWorktree, ignoreWorktrees, moveWorktree, moveWorktrees } from './tasks.actions'

// Ajustes de uma worktree que já está numa tarefa: separar, mover para outra ou ignorar.
export function worktreeMenu(
  w: TaskWorktree,
  task: Task,
  tasks: Task[],
  tr: TFunction,
): MenuItem[] {
  return [
    ...(task.worktrees.length > 1
      ? [{ label: tr('discover.split'), onSelect: () => void moveWorktree(w.path, 'new') }]
      : []),
    ...tasks
      .filter((o) => o.id !== task.id)
      .map((o) => ({
        label: tr('discover.moveTo', { name: o.name }),
        onSelect: () => void moveWorktree(w.path, o.id),
      })),
    {
      label: tr('discover.ignoreWorktree'),
      danger: true,
      onSelect: () => void ignoreWorktree(w.path),
    },
  ]
}

// Worktrees soltas (uma ou um grupo sugerido): juntar a uma tarefa existente ou ignorar.
export function looseMenu(paths: string[], tasks: Task[], tr: TFunction): MenuItem[] {
  return [
    ...tasks.map((t) => ({
      label: tr('discover.joinTo', { name: `${t.key} · ${t.name}` }),
      onSelect: () => void moveWorktrees(paths, t.id),
    })),
    {
      label: tr(paths.length > 1 ? 'discover.ignoreAll' : 'discover.ignoreWorktree'),
      danger: true,
      onSelect: () => void ignoreWorktrees(paths),
    },
  ]
}
