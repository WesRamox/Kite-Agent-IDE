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
  | 'INVALID_SETTINGS'
  | 'INTERNAL'

export interface AppError {
  code: ErrorCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export type AppLanguage = 'pt-BR' | 'en'

export interface AppSettings {
  theme: ThemeId
  language: AppLanguage
  editorFontSize: number
  terminalFontSize: number
  // Salvar o histórico dos terminais ao fechar e restaurar ao reabrir.
  restoreTerminals: boolean
  // Notificações nativas quando um agente espera ou termina.
  notifications: boolean
}

export type SettingsPatch = Partial<Omit<AppSettings, 'theme'>>

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
  // Agente aberto na pasta de uma tarefa multi-repo (Fase 10), em vez de numa worktree própria.
  wsTaskId?: string
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

// Sessão de um agente vista pelos hooks do CLI (Fase 6). Pode estar rodando dentro ou fora do
// Kite; `agentTaskId` liga a sessão a um agente aberto pelo Kite.
export type AgentCli = 'claude' | 'codex' | 'gemini'

export type SessionStatus = 'idle' | 'running' | 'waiting' | 'ended'

// permission: pediu para usar uma ferramenta; turn: terminou o turno e espera o próximo pedido;
// input: pediu outra informação (diálogo do CLI).
export type WaitReason = 'permission' | 'turn' | 'input'

export interface AgentSession {
  id: string
  cli: AgentCli
  cwd: string
  status: SessionStatus
  waitReason: WaitReason | null
  waitingSince: number | null
  // Ferramenta que o agente quer usar (pedido de permissão), ex.: Bash + o comando.
  pending: { tool: string; detail: string } | null
  // O que o agente está fazendo agora (última ferramenta iniciada).
  activity: { tool: string; detail: string } | null
  // Desde quando está trabalhando sem parar para esperar o usuário.
  runningSince: number | null
  // Texto do aviso ou trecho da última resposta do agente.
  lastMessage: string | null
  firstPrompt: string | null
  // Arquivos editados pelo agente (os mais recentes primeiro, limitado).
  touchedPaths: string[]
  touchedCount: number
  agentTaskId: string | null
  // Terminal do Kite em que o agente roda, se for o caso.
  ptyId: string | null
  startedAt: number
  lastEventAt: number
  endedAt: number | null
}

export interface HooksStatus {
  cli: AgentCli
  installed: boolean
  // Caminho do settings.json para exibição (com ~).
  settingsPath: string
  // Trecho JSON que o Kite adiciona ao settings.json.
  snippet: string
  error: string | null
}

// Tarefas multi-repo (Fase 8): grupos de worktrees de repositórios diferentes, descobertos no
// workspace (pasta com vários repos).
export type TaskGroupingMode = 'auto' | 'pattern' | 'manual'

export interface TaskGrouping {
  mode: TaskGroupingMode
  // Ex.: ".worktrees/{tarefa}/{repo}", relativo à pasta aberta (modo 'pattern').
  pattern: string
}

export interface TaskWorktree {
  repo: string
  repoName: string
  path: string
  branch: string | null
  head: string
}

export type TaskSource = 'folder' | 'branch' | 'pattern' | 'manual'

export interface Task {
  id: string
  // Rótulo curto (pasta ou branch), ex.: "PAY-412".
  key: string
  name: string
  cardUrl: string | null
  source: TaskSource
  // Por que estas worktrees foram agrupadas (tela de descoberta).
  why: string
  // Pasta da tarefa quando as worktrees ficam juntas (ex.: .worktrees/PAY-412).
  folder: string | null
  worktrees: TaskWorktree[]
  // Desmarcada na descoberta: não aparece na Central.
  hidden: boolean
  notes: string
}

export interface WorkspaceTasks {
  root: string
  repos: { path: string; name: string }[]
  tasks: Task[]
  unassigned: TaskWorktree[]
  grouping: TaskGrouping
  // O usuário já passou pela tela de descoberta.
  imported: boolean
  // Vínculos manuais sessão → tarefa (vencem a detecção automática).
  sessionLinks: Record<string, string>
}

// Revisão e entrega de uma tarefa multi-repo (Fase 9).
export interface ReviewFile {
  // Caminho relativo à worktree, com '/'.
  rel: string
  status: GitChangeKind
  // null em arquivos binários.
  added: number | null
  deleted: number | null
}

export interface ReviewRepo {
  repoName: string
  worktree: string
  branch: string | null
  base: string
  mergeBase: string | null
  // Arquivos alterados desde o merge-base (commitados ou não).
  files: ReviewFile[]
  added: number
  deleted: number
  // Arquivos ainda não commitados e commits à frente da base.
  uncommitted: number
  ahead: number
  pr: PullSummary | null
  error: string | null
}

// Arquivos alterados de cada worktree da tarefa contra a base (explorer em "Alterados"): a
// mesma conta da revisão, sem +/- e sem consultar PRs, para poder atualizar a cada mudança.
export interface TaskChangesRepo {
  worktree: string
  base: string
  files: { rel: string; status: GitChangeKind }[]
  error: string | null
}

export interface TaskReview {
  taskId: string
  repos: ReviewRepo[]
}

export interface DeliverInput {
  worktrees: string[]
  // Mensagem de commit (obrigatória se algum repo tiver alterações não commitadas).
  message: string
  // Abrir PRs (senão, só commita).
  openPRs: boolean
  title: string
  body: string
  draft: boolean
  // Branch base por worktree (padrão: a detectada na revisão).
  bases: Record<string, string>
}

export interface DeliverResult {
  repoName: string
  worktree: string
  committed: boolean
  pr: { number: number; url: string; created: boolean } | null
  error: string | null
}

// Nova tarefa criada pelo Kite (Fase 10): uma worktree por repositório escolhido.
export interface CreateTaskInput {
  name: string
  branch: string
  repos: string[]
}
