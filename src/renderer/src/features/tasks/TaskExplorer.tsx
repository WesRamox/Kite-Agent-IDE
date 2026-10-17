import type { DirEntry } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TreeApi } from 'react-arborist'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { isMac } from '../../lib/platform'
import { useExplorerStore } from '../explorer/explorer.store'
import { FileTree } from '../explorer/FileTree'
import type { TreeNodeData } from '../explorer/tree-data'
import { openTerminal } from '../terminal/terminal.actions'
import { TaskDot } from './TaskDot'
import { addRepoToTask } from './tasks.actions'
import { taskBaseDir, useActiveTask, useTasksStore } from './tasks.store'
import { useTaskSwitcherStore } from './task-switcher.store'

// Sidebar da tarefa aberta (canvas, tela 2: Task.dc.html, coluna "Explorer da tarefa").

function badge(branch: string | null, ahead: number | undefined): string {
  const b = branch ?? 'sem branch'
  return ahead ? `${b} ↑${ahead}` : b
}

export function TaskExplorer() {
  const task = useActiveTask()
  const status = useTasksStore((s) => s.status)
  const repos = useTasksStore((s) => s.workspace?.repos ?? [])
  const children = useExplorerStore((s) => s.children)
  const treeRef = useRef<TreeApi<TreeNodeData> | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)

  // Arquivos soltos na pasta da tarefa (ex.: TASK.md), sem as pastas das worktrees.
  const folder = task?.folder ?? null
  useEffect(() => {
    if (folder && !(folder in useExplorerStore.getState().children)) {
      void useExplorerStore.getState().load(folder)
    }
  }, [folder])
  const loose: DirEntry[] = useMemo(
    () => (folder ? (children[folder] ?? []).filter((e) => e.kind === 'file') : []),
    [folder, children],
  )
  const forest = useMemo(
    () => ({
      roots: (task?.worktrees ?? []).map((w) => {
        const st = status[w.path]
        return {
          path: w.path,
          name: w.repoName,
          badge: badge(w.branch, st?.isRepo ? st.ahead : undefined),
        }
      }),
      loose,
    }),
    [task, status, loose],
  )

  if (!task) return null
  const missing = repos.filter((r) => !task.worktrees.some((w) => w.repo === r.path))
  const mod = isMac ? '⌘' : 'Ctrl+'
  const nRepos = task.worktrees.length

  return (
    <div className="flex min-h-0 flex-1 flex-col font-geist">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <button
          type="button"
          aria-label="Trocar de tarefa"
          onClick={() => useTaskSwitcherStore.getState().show()}
          className="flex items-center gap-2 rounded-[7px] border border-border bg-surface-0 px-2.5 py-2 text-left text-fg hover:border-fg-muted/40"
        >
          <TaskDot taskId={task.id} />
          <span className="font-geist-mono text-[11px] text-fg-muted">{task.key}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{task.name}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 stroke-fg-muted"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M7 10l5 5 5-5" />
          </svg>
        </button>
        <div className="flex gap-1.5 text-[11px] text-fg-muted">
          <span>{mod}K troca de tarefa</span>
          <span>·</span>
          <span>
            {mod}P busca {nRepos === 1 ? 'no repo' : `nos ${nRepos} repos`}
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-1 pt-1.5">
        <FileTree
          root={taskBaseDir(task) ?? task.worktrees[0]?.path ?? ''}
          treeRef={treeRef}
          forest={forest}
          rootMenu={(path) => [
            { label: 'Abrir terminal aqui', onSelect: () => openTerminal({ cwd: path }) },
          ]}
        />
        <button
          type="button"
          disabled={missing.length === 0}
          title={
            missing.length === 0 ? 'Todos os repositórios do workspace já estão aqui' : undefined
          }
          onClick={(e) =>
            setMenu({
              x: e.clientX,
              y: e.clientY,
              items: missing.map((r) => ({
                label: r.name,
                onSelect: () => void addRepoToTask(task.id, r.path),
              })),
            })
          }
          className="mx-2 mt-2.5 mb-3 h-[30px] shrink-0 rounded-md border border-dashed border-fg-muted/30 bg-transparent text-xs text-fg-muted hover:text-fg disabled:opacity-50"
        >
          + Adicionar repositório à tarefa
        </button>
      </div>
      {menu && menu.items.length > 0 && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
