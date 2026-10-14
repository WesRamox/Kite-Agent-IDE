// Tipos de domínio compartilhados entre main, preload e renderer.
import type { ThemeId } from './themes'

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
  | 'NOT_CONFIGURED'
  | 'NOT_AUTHENTICATED'
  | 'NOT_GITHUB_REPO'
  | 'GITHUB_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL'

export interface AppError {
  code: ErrorCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export interface AppSettings {
  theme: ThemeId
}

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
  // Total de caracteres emitidos por este PTY até o fim deste trecho (para reconectar a um
  // terminal sem duplicar saída).
  end: number
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

export interface GitHubUser {
  login: string
  name: string | null
  avatarUrl: string
}

export interface GitHubAuthState {
  // GITHUB_CLIENT_ID definido.
  configured: boolean
  user: GitHubUser | null
  // false quando o SO não oferece criptografia real: o token fica só em memória.
  secureStorage: boolean
}

export interface DeviceFlowStart {
  flowId: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export type DeviceFlowPoll =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'success'; user: GitHubUser }

export interface GitHubRepoRef {
  owner: string
  repo: string
  defaultBranch: string
  url: string
  private: boolean
}

export type GitHubItemState = 'open' | 'closed' | 'all'

export interface PullSummary {
  number: number
  title: string
  author: string | null
  state: 'open' | 'closed' | 'merged'
  draft: boolean
  headRef: string
  baseRef: string
  updatedAt: string
  url: string
  fromFork: boolean
}

export interface IssueSummary {
  number: number
  title: string
  author: string | null
  state: 'open' | 'closed'
  labels: { name: string; color: string }[]
  comments: number
  updatedAt: string
  url: string
}

export type ChecksState = 'success' | 'failure' | 'pending' | 'none'

export interface CheckRun {
  name: string
  // queued | in_progress | completed (check runs) ou pending | success | failure | error (status)
  status: string
  conclusion: string | null
  url: string | null
}

export interface ChecksSummary {
  state: ChecksState
  runs: CheckRun[]
}

export interface PullDetail extends PullSummary {
  body: string
  headSha: string
  additions: number
  deletions: number
  changedFiles: number
  mergeable: boolean | null
  checks: ChecksSummary
}

export interface IssueDetail extends IssueSummary {
  body: string
}

export interface CreatePullInput {
  title: string
  body: string
  base: string
  draft: boolean
}

export type AgentStatus = 'running' | 'waiting' | 'done' | 'error'

export type AgentPromptMode = 'arg' | 'type'

export interface AgentPreset {
  id: string
  name: string
  // Comando executado no shell do usuário dentro da worktree.
  command: string
  // 'arg': o prompt vai como argumento (depois de `promptFlag`, se houver).
  // 'type': o prompt é digitado no terminal quando o agente fica pronto.
  promptMode: AgentPromptMode
  promptFlag: string
}

export interface AgentTask {
  id: string
  name: string
  presetId: string
  presetName: string
  branch: string
  baseBranch: string
  worktreePath: string
  // Worktree principal do repositório onde a tarefa foi criada.
  repoPath: string
  status: AgentStatus
  // O processo ainda existe (pode estar running ou waiting).
  alive: boolean
  // O app foi fechado com o agente rodando.
  interrupted: boolean
  startedAt: number
  endedAt: number | null
  exitCode: number | null
}

export interface StartAgentInput {
  root: string
  name: string
  presetId: string
  prompt: string
}

export interface AgentAttach {
  ptyId: string | null
  history: string
  end: number
}

export interface AgentReview {
  base: string
  mergeBase: string
  files: { path: string; status: GitChangeKind }[]
}
