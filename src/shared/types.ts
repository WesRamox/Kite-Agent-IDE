// Tipos de domínio compartilhados entre main, preload e renderer.

export type ErrorCode =
  | 'INVALID_ARGS'
  | 'NOT_FOUND'
  | 'FORBIDDEN_PATH'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'FILE_TOO_LARGE'
  | 'BINARY_FILE'
  | 'NOT_A_REPO'
  | 'GIT_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL'

export interface AppError {
  code: ErrorCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export interface AppInfo {
  name: string
  version: string
  platform: string
  versions: { electron: string; chrome: string; node: string }
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
}

export type FileEncoding = 'utf8' | 'utf8bom'

export interface FileContent {
  content: string
  encoding: FileEncoding
}

export type FsChangeType = 'create' | 'update' | 'delete'

export interface FsChangedEvent {
  root: string
  events: { type: FsChangeType; path: string }[]
}

export interface ConfirmOptions {
  message: string
  detail?: string
  // O primeiro botão é a ação principal; o último é o cancelamento.
  buttons: string[]
  kind?: 'info' | 'warning' | 'question'
}

export interface PtyCreateOptions {
  cwd: string
  shell?: string
  cols: number
  rows: number
  env?: Record<string, string>
}

export interface PtyDataEvent {
  id: string
  data: string
}

export interface PtyExitEvent {
  id: string
  exitCode: number
}

// Terminal salvo ao fechar o app/workspace, restaurado ao reabrir.
export interface TerminalSession {
  title: string
  scrollback: string
}

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
