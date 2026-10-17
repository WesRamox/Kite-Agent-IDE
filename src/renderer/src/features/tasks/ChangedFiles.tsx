import type { DirEntry, Task, TaskChangesRepo } from '@shared/types'
import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { join } from '../../lib/paths'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { openFile } from '../editor/editor.actions'
import { useEditorStore } from '../editor/editor.store'
import { FileIcon } from '../explorer/FileIcon'
import { KIND_COLOR, KIND_LABEL, KIND_LETTER } from '../git/git-format'
import { groupChanges } from './changed-files'
import { openTaskReview } from './review.actions'
import { useTasksStore } from './tasks.store'

// Explorer da tarefa em "Alterados": por worktree, só os arquivos que mudaram contra a branch
// base (commitados na branch ou não), agrupados por pasta.

const REFRESH_MS = 300

const ROW = 'flex h-[26px] shrink-0 items-center gap-1.5 rounded-[5px] pr-2.5'

function fullPath(worktree: string, rel: string): string {
  return rel.split('/').reduce(join, worktree)
}

// Recarrega quando o status git de alguma worktree da tarefa muda (o watcher do .git dispara).
function useTaskChanges(task: Task): TaskChangesRepo[] | null {
  const root = useWorkspaceStore((s) => s.root)
  const status = useTasksStore((s) => s.status)
  const [changes, setChanges] = useState<{ taskId: string; repos: TaskChangesRepo[] } | null>(null)
  const signal = task.worktrees.map((w) => status[w.path])
  useEffect(() => {
    if (!root) return
    let alive = true
    const timer = setTimeout(() => {
      void window.api.review.changes(root, task.id).then((res) => {
        if (alive && res.ok) setChanges({ taskId: task.id, repos: res.data })
      })
    }, REFRESH_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, task.id, ...signal])
  return changes?.taskId === task.id ? changes.repos : null
}

export function ChangedFiles({
  task,
  loose,
  badges,
}: {
  task: Task
  loose: DirEntry[]
  badges: Record<string, string>
}) {
  const repos = useTaskChanges(task)
  const activePath = useEditorStore((s) => s.activePath)
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const byWorktree = useMemo(() => new Map((repos ?? []).map((r) => [r.worktree, r])), [repos])

  const toggle = (path: string) =>
    setClosed((c) => {
      const next = new Set(c)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const fileRow = (
    path: string,
    name: string,
    indent: number,
    kind?: TaskChangesRepo['files'][number]['status'],
  ) => (
    <button
      key={path}
      type="button"
      title={path}
      onClick={() => (kind === 'deleted' ? void openTaskReview(task.id) : void openFile(path))}
      style={{ paddingLeft: indent }}
      className={`${ROW} w-full text-left ${
        activePath === path ? 'bg-surface-3 text-fg' : 'text-fg/90 hover:bg-surface-2'
      }`}
    >
      <FileIcon name={name} kind="file" open={false} />
      <span className={`min-w-0 flex-1 truncate ${kind ? KIND_COLOR[kind] : 'text-fg-muted'}`}>
        {name}
      </span>
      {kind && (
        <span title={KIND_LABEL[kind]} className={`font-mono text-[11px] ${KIND_COLOR[kind]}`}>
          {KIND_LETTER[kind]}
        </span>
      )}
    </button>
  )

  return (
    <div
      role="tree"
      aria-label="Arquivos alterados"
      className="flex min-h-0 flex-1 flex-col overflow-auto text-[13px]"
    >
      {loose.map((e) => fileRow(e.path, e.name, 8))}
      {task.worktrees.map((w) => {
        const repo = byWorktree.get(w.path)
        const open = !closed.has(w.path)
        const groups = groupChanges(repo?.files ?? [])
        return (
          <div key={w.path} role="group" aria-label={w.repoName} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(w.path)}
              aria-expanded={open}
              className={`${ROW} w-full pl-0.5 text-left text-fg hover:bg-surface-2`}
            >
              <ChevronRight
                size={14}
                className={`shrink-0 text-fg-muted transition-transform ${open ? 'rotate-90' : ''}`}
              />
              <span className="truncate font-semibold">{w.repoName}</span>
              <span className="ml-auto flex shrink-0 items-center gap-2 font-geist-mono text-[11px] text-fg-muted">
                <span>{badges[w.path]}</span>
                {repo && <span>{repo.files.length}</span>}
              </span>
            </button>
            {open && !repo && (
              <span className="py-1 pl-[22px] text-xs text-fg-muted">Carregando…</span>
            )}
            {open && repo?.error && (
              <span className="py-1 pl-[22px] text-xs text-fg-muted" title={repo.error}>
                Não foi possível comparar com {repo.base}.
              </span>
            )}
            {open && repo && !repo.error && repo.files.length === 0 && (
              <span className="py-1 pl-[22px] text-xs text-fg-muted">
                Nada alterado contra {repo.base}.
              </span>
            )}
            {open &&
              groups.map((g) => (
                <div key={g.dir} className="flex flex-col">
                  {g.dir && (
                    <div
                      title={g.dir}
                      className={`${ROW} pl-[22px] font-geist-mono text-[12px] text-fg-muted`}
                    >
                      <span className="truncate">{g.dir}</span>
                    </div>
                  )}
                  {g.files.map((f) =>
                    fileRow(fullPath(w.path, f.rel), f.name, g.dir ? 36 : 22, f.status),
                  )}
                </div>
              ))}
          </div>
        )
      })}
    </div>
  )
}
