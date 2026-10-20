// Agentes abertos pelo Kite e sessões vistas pelos hooks.
import type { GitChangeKind } from './git'

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
  // Pastas criadas por `git worktree add` nesta sessão (as mais recentes primeiro): o agente que
  // montou a tarefa fica ligado a ela.
  createdWorktrees: string[]
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
