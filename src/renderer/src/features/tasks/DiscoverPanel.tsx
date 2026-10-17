import type { Task, TaskWorktree } from '@shared/types'
import { useState } from 'react'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { tildePath } from '../agents/session-format'
import {
  addExternalRepo,
  ignoreWorktree,
  importTasks,
  moveWorktree,
  renameTask,
} from './tasks.actions'
import { GroupingFieldset } from './GroupingFieldset'
import { useTasksStore } from './tasks.store'
import { useT } from '../../lib/i18n'

// Tela 4 do canvas "Kite — Tarefas multi-repo" (Discover.dc.html).

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'
const SMALL_BTN =
  'h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3'

function relPath(root: string, p: string): string {
  return p.startsWith(`${root}/`) ? p.slice(root.length + 1) : tildePath(p)
}

export function DiscoverPanel() {
  const ws = useTasksStore((s) => s.workspace)
  if (!ws) return null
  // Remonta ao trocar de workspace, para começar com o que já estava escondido.
  return <DiscoverBody key={ws.root} />
}

function DiscoverBody() {
  const ws = useTasksStore((s) => s.workspace)
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(ws?.tasks.filter((t) => t.hidden).map((t) => t.id) ?? []),
  )
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const tr = useT()

  if (!ws) return null
  const total = ws.tasks.reduce((n, t) => n + t.worktrees.length, 0) + ws.unassigned.length
  const chosen = ws.tasks.filter((t) => !hidden.has(t.id)).length
  const toggle = (id: string) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const countByRepo = (repo: string) =>
    ws.tasks.flatMap((t) => t.worktrees).filter((w) => w.repo === repo).length +
    ws.unassigned.filter((w) => w.repo === repo).length

  return (
    <div className="h-full overflow-y-auto bg-surface-0 font-geist text-[13px] text-fg">
      <div className="flex min-h-full justify-center px-6 py-9">
        <div className="flex w-full max-w-[1120px] flex-col gap-6">
          <header className="flex flex-wrap items-end gap-4">
            <div className="flex-[1_1_420px]">
              <span className={LABEL}>{tr('discover.workspace')}</span>
              <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
                {tildePath(ws.root)}
              </h1>
              <p className="mt-2 leading-normal text-fg-muted">
                {tr('discover.found', { repos: ws.repos.length, worktrees: total })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void importTasks([...hidden])}
              className="h-9 rounded-lg bg-accent px-4 font-semibold text-accent-fg hover:bg-accent/85"
            >
              {tr('discover.import', { n: chosen })}
            </button>
          </header>

          <div className="flex flex-wrap items-start gap-6">
            <aside className="flex max-w-[320px] flex-[1_1_280px] flex-col gap-[18px]">
              <GroupingFieldset grouping={ws.grouping} />
              <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
                <span className={LABEL}>{tr('discover.repos')}</span>
                {ws.repos.map((r) => {
                  const n = countByRepo(r.path)
                  return (
                    <div key={r.path} className="flex items-center gap-2" title={r.path}>
                      <span className="font-geist-mono">{r.name}</span>
                      <span className="ml-auto text-xs text-fg-muted">
                        {tr('discover.worktrees', { n })}
                      </span>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => void addExternalRepo()}
                  className="mt-1 h-7 rounded-md border border-dashed border-fg-muted/30 bg-transparent text-xs text-fg-muted hover:text-fg"
                >
                  {tr('discover.addExternal')}
                </button>
              </div>
              <p className="text-xs leading-normal text-fg-muted">{tr('discover.watching')}</p>
            </aside>

            <section
              aria-label={tr('discover.found.label')}
              className="flex min-w-0 flex-[999_1_520px] flex-col gap-3"
            >
              {ws.tasks.length === 0 && <p className="text-fg-muted">{tr('discover.none')}</p>}
              {ws.tasks.map((t) => (
                <TaskCard
                  key={`${t.id}:${t.name}`}
                  task={t}
                  root={ws.root}
                  checked={!hidden.has(t.id)}
                  onToggle={() => toggle(t.id)}
                />
              ))}
              {ws.unassigned.length > 0 && (
                <div className="flex flex-col gap-2.5 rounded-[10px] border border-dashed border-fg-muted/30 px-4 py-3.5">
                  <span className={LABEL}>{tr('discover.loose')}</span>
                  {ws.unassigned.map((w) => (
                    <LooseRow
                      key={w.path}
                      wt={w}
                      root={ws.root}
                      onJoin={(x, y) =>
                        setMenu({
                          x,
                          y,
                          items: ws.tasks.map((t) => ({
                            label: `${t.key} · ${t.name}`,
                            onSelect: () => void moveWorktree(w.path, t.id),
                          })),
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      {menu && menu.items.length > 0 && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

function TaskCard(props: { task: Task; root: string; checked: boolean; onToggle: () => void }) {
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
      </div>
      {task.worktrees.map((w) => (
        <div key={w.path} className="flex flex-wrap items-center gap-2.5 pl-[26px] text-xs">
          <span className="w-14 font-geist-mono font-medium">{w.repoName}</span>
          <span className="flex-[1_1_260px] truncate font-geist-mono text-fg-muted" title={w.path}>
            {relPath(props.root, w.path)}
          </span>
          <span className="text-fg-muted">{w.branch ?? `(${w.head})`}</span>
        </div>
      ))}
    </div>
  )
}

function LooseRow(props: {
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
