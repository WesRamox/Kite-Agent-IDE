import type { GitFileChange, GitStatus, PullSummary, Task, WorkspaceTasks } from '@shared/types'
import { create } from 'zustand'
import { indexStatus } from '../git/git.store'

interface TasksState {
  workspace: WorkspaceTasks | null
  // Tarefa do contexto ativo (null = workspace).
  activeTaskId: string | null
  // Status git de cada worktree das tarefas abertas, e os índices para a árvore de arquivos.
  status: Record<string, GitStatus>
  byPath: Map<string, GitFileChange>
  changedDirs: Set<string>
  // PR de cada worktree (null = sem PR), quando há GitHub e login.
  prs: Record<string, PullSummary | null>
  set: (patch: Partial<Pick<TasksState, 'workspace' | 'activeTaskId'>>) => void
  setStatus: (path: string, status: GitStatus) => void
  setPRs: (prs: Record<string, PullSummary | null>) => void
  reset: () => void
}

export const useTasksStore = create<TasksState>((set) => ({
  workspace: null,
  activeTaskId: null,
  status: {},
  byPath: new Map(),
  changedDirs: new Set(),
  prs: {},
  set: (patch) => set(patch),
  setPRs: (prs) => set((s) => ({ prs: { ...s.prs, ...prs } })),
  setStatus: (path, status) =>
    set((s) => {
      const all = { ...s.status, [path]: status }
      const byPath = new Map<string, GitFileChange>()
      const changedDirs = new Set<string>()
      for (const [root, st] of Object.entries(all)) {
        const idx = indexStatus(st, root)
        idx.byPath.forEach((v, k) => byPath.set(k, v))
        idx.changedDirs.forEach((d) => changedDirs.add(d))
      }
      return { status: all, byPath, changedDirs }
    }),
  reset: () =>
    set({
      workspace: null,
      activeTaskId: null,
      status: {},
      byPath: new Map(),
      changedDirs: new Set(),
      prs: {},
    }),
}))

export function activeTask(): Task | null {
  const { workspace, activeTaskId } = useTasksStore.getState()
  return workspace?.tasks.find((t) => t.id === activeTaskId) ?? null
}

export function useActiveTask(): Task | null {
  return useTasksStore((s) => s.workspace?.tasks.find((t) => t.id === s.activeTaskId) ?? null)
}

// Pasta padrão dos terminais da tarefa ativa: a pasta da tarefa ou a primeira worktree.
export function taskBaseDir(task: Task | null = activeTask()): string | null {
  if (!task) return null
  return task.folder ?? task.worktrees[0]?.path ?? null
}

export function taskContext(id: string): string {
  return `task:${id}`
}

// Worktree da tarefa que contém o caminho (para o nome do repo nas abas e no quick open).
export function worktreeOf(task: Task | null, file: string): Task['worktrees'][number] | null {
  return task?.worktrees.find((w) => file === w.path || file.startsWith(`${w.path}/`)) ?? null
}
