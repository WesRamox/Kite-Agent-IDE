import type { Task } from '@shared/types'
import { CircleCheck } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { removeTaskWorktrees, setTaskDone } from './task-completion.actions'

// Concluir a tarefa nos detalhes (fora do canvas, ver docs/decisions.md). Concluída, oferece
// desmarcar e excluir as worktrees.

const BUTTON =
  'h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3'

export function TaskDoneActions({ task }: { task: Task }) {
  const t = useT()
  if (!task.done) {
    return (
      <button
        type="button"
        onClick={() => void setTaskDone(task.id, true)}
        className={`${BUTTON} self-start`}
      >
        {t('details.markDone')}
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs text-success">
        <CircleCheck size={14} aria-hidden="true" />
        {t('details.done')}
      </span>
      <button type="button" onClick={() => void setTaskDone(task.id, false)} className={BUTTON}>
        {t('details.unmarkDone')}
      </button>
      <button
        type="button"
        onClick={() => void removeTaskWorktrees(task.id)}
        className={`${BUTTON} text-danger`}
      >
        {t('details.removeWorktrees')}
      </button>
    </div>
  )
}
