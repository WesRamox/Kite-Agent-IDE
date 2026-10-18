// Tarefas multi-repo, revisão e entrega.
import type { GitChangeKind } from './git'
import type { PullSummary } from './github'

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
  // `external`: adicionado de outra pasta (sai da lista ao remover).
  repos: { path: string; name: string; external: boolean }[]
  // Achados na varredura, mas tirados do workspace pelo usuário.
  ignoredRepos: { path: string; name: string }[]
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
