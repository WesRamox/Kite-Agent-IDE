import type { Task, TaskWorktree } from '@shared/types'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { isInside, relative } from '../../lib/paths'
import { tildePath } from '../../lib/session-format'
import { removeTask, renameTask } from './tasks.actions'

export const SMALL_BTN =
  'h-[26px] shrink-0 whitespace-nowrap rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3'
// Repositório | branch e caminho | ações: as linhas de todos os cartões alinham pelas mesmas colunas.
export const ROW =
  'grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_auto] items-center gap-x-3 text-xs'

// Caminho relativo à pasta aberta (com '/'); fora dela, abreviado com ~.
function relPath(root: string, p: string): string {
  return isInside(root, p) && p !== root ? relative(root, p) : tildePath(p)
}

export function MenuButton(props: { label: string; onOpen: (x: number, y: number) => void }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={(e) => props.onOpen(e.clientX, e.clientY)}
      className="flex size-[26px] shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
    >
      <MoreHorizontal size={14} />
    </button>
  )
}

export function RepoName({ wt }: { wt: TaskWorktree }) {
  return (
    <span className="truncate font-geist-mono font-medium" title={wt.repoName}>
      {wt.repoName}
    </span>
  )
}

// Branch (ou o commit, se destacada) em cima e o caminho embaixo, cortados com reticências.
export function Where(props: { wt: TaskWorktree; root: string; showBranch: boolean }) {
  const { wt } = props
  const rel = relPath(props.root, wt.path)
  return (
    <span className="flex min-w-0 flex-col">
      {props.showBranch && (
        <span className="truncate text-fg" title={wt.branch ?? wt.head}>
          {wt.branch ?? `(${wt.head.slice(0, 7)})`}
        </span>
      )}
      <span className="truncate font-geist-mono text-fg-muted" title={wt.path}>
        {rel}
      </span>
    </span>
  )
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
      <div className="flex flex-col gap-2 pl-[26px]">
        {task.worktrees.map((w) => (
          <div key={w.path} className={ROW}>
            <RepoName wt={w} />
            <Where wt={w} root={props.root} showBranch />
            <MenuButton
              label={tr('discover.worktreeActions', { name: w.repoName })}
              onOpen={(x, y) => props.onWorktreeMenu(w, x, y)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
