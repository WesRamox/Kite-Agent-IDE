import type { GitBranch, GitFileChange, GitStatus, GitWorktree } from '@shared/types'
import { create } from 'zustand'
import { dirname, isInside } from '../../lib/paths'

interface GitState {
  root: string | null
  status: GitStatus | null
  branches: GitBranch[]
  worktrees: GitWorktree[]
  // Índices derivados do status, para a árvore de arquivos.
  byPath: Map<string, GitFileChange>
  changedDirs: Set<string>
  set: (data: Partial<Pick<GitState, 'root' | 'status' | 'branches' | 'worktrees'>>) => void
  reset: (root: string | null) => void
}

function index(status: GitStatus | null, root: string | null) {
  const byPath = new Map<string, GitFileChange>()
  const changedDirs = new Set<string>()
  if (status?.isRepo && root) {
    for (const f of status.files) {
      byPath.set(f.path, f)
      if (f.unstaged === 'deleted' || f.staged === 'deleted') continue
      for (let d = dirname(f.path); isInside(root, d) && d !== root; d = dirname(d)) {
        if (changedDirs.has(d)) break
        changedDirs.add(d)
      }
    }
  }
  return { byPath, changedDirs }
}

export const useGitStore = create<GitState>((set, get) => ({
  root: null,
  status: null,
  branches: [],
  worktrees: [],
  byPath: new Map(),
  changedDirs: new Set(),
  set: (data) => {
    const root = data.root !== undefined ? data.root : get().root
    const status = data.status !== undefined ? data.status : get().status
    set({ ...data, ...(data.status !== undefined ? index(status, root) : {}) })
  },
  reset: (root) =>
    set({
      root,
      status: null,
      branches: [],
      worktrees: [],
      byPath: new Map(),
      changedDirs: new Set(),
    }),
}))
