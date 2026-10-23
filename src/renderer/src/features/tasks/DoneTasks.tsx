import type { Task } from '@shared/types'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { t, useT } from '../../lib/i18n'
import { removeTaskWorktrees, setTaskDone } from './task-completion.actions'
import { openTask } from './tasks.actions'
import { isDoneTask, useTasksStore } from './tasks.store'

// Tarefas concluídas (fora do canvas, ver docs/decisions.md): recolhidas no fim da Central, como
// as escondidas, com "Desmarcar" e a exclusão das worktrees.

function doneMenu(task: Task): MenuItem[] {
  return [
    { label: t('sidebar.menu.openTask'), onSelect: () => void openTask(task.id) },
    { label: t('sidebar.menu.unmarkDone'), onSelect: () => void setTaskDone(task.id, false) },
    {
      label: t('sidebar.menu.removeWorktrees'),
      danger: true,
      onSelect: () => void removeTaskWorktrees(task.id),
    },
  ]
}

export function DoneTasks() {
  const tr = useT()
  const tasks = useTasksStore((s) => (s.workspace?.imported ? s.workspace.tasks : undefined))
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const done = tasks?.filter(isDoneTask) ?? []
  if (done.length === 0) return null
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1 text-left text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase hover:text-fg"
      >
        {tr('sidebar.done', { n: done.length })}
        <span className="ml-auto font-normal normal-case">
          {open ? tr('sidebar.hiddenCollapse') : tr('sidebar.hiddenExpand')}
        </span>
      </button>
      {open &&
        done.map((task) => (
          <div
            key={task.id}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY, items: doneMenu(task) })
            }}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-fg-muted hover:bg-surface-2"
          >
            <button
              type="button"
              aria-label={tr('sidebar.openDoneLabel', { name: task.name })}
              onClick={() => void openTask(task.id)}
              className="flex min-w-0 flex-1 items-baseline gap-2 text-left hover:text-fg"
            >
              <span className="font-geist-mono text-[11px]">
                {task.key === task.name ? '' : task.key}
              </span>
              <span className="min-w-0 flex-1 truncate line-through decoration-fg-muted/60">
                {task.name}
              </span>
            </button>
            <button
              type="button"
              aria-label={tr('sidebar.unmarkDoneLabel', { name: task.name })}
              onClick={() => void setTaskDone(task.id, false)}
              className="text-xs hover:text-fg"
            >
              {tr('sidebar.unmarkDone')}
            </button>
            <button
              type="button"
              aria-label={tr('sidebar.removeWorktreesLabel', { name: task.name })}
              title={tr('sidebar.menu.removeWorktrees')}
              onClick={() => void removeTaskWorktrees(task.id)}
              className="rounded p-0.5 hover:text-danger"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
