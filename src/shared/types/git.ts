// Git local: status, diff, branches e worktrees.

export type GitChangeKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typechange'
  | 'untracked'
  | 'conflicted'

export interface GitFileChange {
  // Caminho absoluto no disco.
  path: string
  // Caminho anterior (renomeações).
  origPath?: string
  staged: GitChangeKind | null
  unstaged: GitChangeKind | null
}

export interface GitRepoStatus {
  isRepo: true
  // null quando o HEAD está destacado (detached).
  branch: string | null
  head: string | null
  upstream: string | null
  ahead: number
  behind: number
  files: GitFileChange[]
  // Raiz da worktree atual e se ela é a worktree principal do repositório.
  worktreePath: string
  isMainWorktree: boolean
}

export type GitStatus = GitRepoStatus | { isRepo: false }

export interface GitBranch {
  name: string
  current: boolean
  upstream: string | null
  // Worktree onde a branch está em uso, se houver.
  worktreePath: string | null
}

export interface GitWorktree {
  path: string
  branch: string | null
  head: string
  isMain: boolean
  isCurrent: boolean
  locked: boolean
  prunable: boolean
}

export interface GitDiff {
  original: string
  modified: string
  binary: boolean
}

export interface GitChangedEvent {
  root: string
}
