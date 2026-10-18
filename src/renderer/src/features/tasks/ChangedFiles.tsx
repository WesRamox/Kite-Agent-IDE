import type { DirEntry, Task, TaskChangesRepo } from '@shared/types'
import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { join } from '../../lib/paths'
import { openFile } from '../editor/editor.actions'
import { useEditorStore } from '../editor/editor.store'
import { FileIcon } from '../../components/FileIcon'
import { KIND_COLOR, kindLabel, KIND_LETTER } from '../../lib/git-format'
import { groupChanges } from './changed-files'
import { openTaskReview } from './review.actions'
import { useTaskChanges } from './use-task-changes'
import { useT } from '../../lib/i18n'

// Explorer da tarefa em "Alterados": por worktree, só os arquivos que mudaram contra a branch
// base (commitados na branch ou não), agrupados por pasta.

const ROW = 'flex h-[26px] shrink-0 items-center gap-1.5 rounded-[5px] pr-2.5'

function fullPath(worktree: string, rel: string): string {
  return rel.split('/').reduce(join, worktree)
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
  const t = useT()
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
        <span title={kindLabel(kind)} className={`font-mono text-[11px] ${KIND_COLOR[kind]}`}>
          {KIND_LETTER[kind]}
        </span>
      )}
    </button>
  )

  return (
    <div
      role="tree"
      aria-label={t('changed.tree')}
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
              <span className="py-1 pl-[22px] text-xs text-fg-muted">{t('common.loading')}</span>
            )}
            {open && repo?.error && (
              <span className="py-1 pl-[22px] text-xs text-fg-muted" title={repo.error}>
                {t('changed.cannotCompare', { base: repo.base })}
              </span>
            )}
            {open && repo && !repo.error && repo.files.length === 0 && (
              <span className="py-1 pl-[22px] text-xs text-fg-muted">
                {t('changed.nothing', { base: repo.base })}
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
