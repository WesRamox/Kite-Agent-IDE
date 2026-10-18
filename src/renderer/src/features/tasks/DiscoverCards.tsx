import type { Task, TaskWorktree } from '@shared/types'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { tildePath } from '../../lib/session-format'
import { ignoreWorktree, moveWorktree, removeTask, renameTask } from './tasks.actions'

const SMALL_BTN =
  'h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3'

function relPath(root: string, p: string): string {
  return p.startsWith(`${root}/`) ? p.slice(root.length + 1) : tildePath(p)
}

export function TaskCard(props: {
  task: Task
  root: string
  checked: boolean
  onToggle: () => void
  onWorktreeMenu: (w: TaskWorktree, x: number, y: number) => void
}) {
  const { task } = props
  const [name, setName] = useState(task.name)
  const tr = useT()
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={props.onToggle}
          aria-label={tr('discover.importTask', { name: task.name })}
          className="size-4 accent-accent"
        />
        <input
          type="text"
          value={name}
          aria-label={tr('discover.taskName')}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== task.name && void renameTask(task.id, name)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-[30px] flex-[1_1_220px] rounded-md border border-border bg-surface-0 px-2.5 font-medium text-fg"
        />
        <span className="text-xs text-fg-muted">{task.why}</span>
        {task.source === 'manual' && (
          <button
            type="button"
            aria-label={tr('discover.removeTaskLabel', { name: task.name })}
            onClick={() => void removeTask(task.id)}
            className="h-[26px] rounded-md bg-transparent px-2 text-xs text-fg-muted hover:text-fg"
          >
            {tr('discover.removeTask')}
          </button>
        )}
      </div>
      {task.worktrees.map((w) => (
        <div key={w.path} className="flex flex-wrap items-center gap-2.5 pl-[26px] text-xs">
          <span className="w-14 font-geist-mono font-medium">{w.repoName}</span>
          <span className="flex-[1_1_260px] truncate font-geist-mono text-fg-muted" title={w.path}>
            {relPath(props.root, w.path)}
          </span>
          <span className="text-fg-muted">{w.branch ?? `(${w.head})`}</span>
          <button
            type="button"
            aria-label={tr('discover.worktreeActions', { name: w.repoName })}
            onClick={(e) => props.onWorktreeMenu(w, e.clientX, e.clientY)}
            className="flex size-6 items-center justify-center rounded text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function LooseRow(props: {
  wt: TaskWorktree
  root: string
  onJoin: (x: number, y: number) => void
}) {
  const { wt } = props
  const tr = useT()
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <span className="w-14 font-geist-mono font-medium">{wt.repoName}</span>
      <span className="flex-[1_1_260px] font-geist-mono text-fg-muted" title={wt.path}>
        {relPath(props.root, wt.path)}
      </span>
      <span className="text-fg-muted">{wt.branch ?? `(${wt.head})`}</span>
      <button type="button" onClick={() => void moveWorktree(wt.path, 'new')} className={SMALL_BTN}>
        {tr('discover.createTask')}
      </button>
      <button
        type="button"
        onClick={(e) => props.onJoin(e.clientX, e.clientY)}
        className={SMALL_BTN}
      >
        {tr('discover.join')}
      </button>
      <button
        type="button"
        onClick={() => void ignoreWorktree(wt.path)}
        className="h-[26px] rounded-md bg-transparent px-2.5 text-xs text-fg-muted hover:text-fg"
      >
        {tr('discover.ignore')}
      </button>
    </div>
  )
}
