import type { AgentSession, AgentTask, WaitReason } from '@shared/types'
import { basename } from '../../lib/paths'
import { tildePath } from './session-format'

// Modelo da Central de atenção (Fase 7): junta as sessões vistas pelos hooks e os agentes
// abertos pelo Kite numa lista só, agrupada pelo que pede do usuário.

export type AttentionGroup = 'waiting' | 'running' | 'review' | 'idle'

export interface AttentionItem {
  id: string
  group: AttentionGroup
  // Rótulo curto (pasta do repo ou da sessão), em fonte mono.
  key: string
  name: string
  // Situação em poucas palavras (linha de baixo na sidebar).
  meta: string
  waitReason: WaitReason | null
  // Desde quando está no grupo atual (espera, trabalho ou fim).
  since: number
  session: AgentSession | null
  task: AgentTask | null
  // Roda num terminal do Kite: dá para responder ali mesmo.
  inKite: boolean
}

export const GROUP_LABEL: Record<AttentionGroup, string> = {
  waiting: 'Esperando você',
  running: 'Trabalhando',
  review: 'Para revisar',
  idle: 'Sem agente',
}

export const GROUP_ORDER: AttentionGroup[] = ['waiting', 'running', 'review', 'idle']

const WAIT_LABEL: Record<WaitReason, string> = {
  permission: 'pede permissão',
  turn: 'sua vez',
  input: 'precisa de resposta',
}

// Sessões encerradas só interessam se mexeram em algo; somem depois desse tempo.
const REVIEW_WINDOW_MS = 12 * 60 * 60 * 1000

function taskItem(task: AgentTask, session: AgentSession | undefined): AttentionItem {
  const base = {
    id: `task:${task.id}`,
    key: basename(task.repoPath),
    name: task.name,
    session: session ?? null,
    task,
    inKite: true,
  }
  if (task.alive && task.status === 'waiting') {
    const reason = session?.status === 'waiting' ? session.waitReason : null
    return {
      ...base,
      group: 'waiting',
      meta: reason ? WAIT_LABEL[reason] : 'esperando você',
      waitReason: reason,
      since: session?.waitingSince ?? session?.lastEventAt ?? task.startedAt,
    }
  }
  if (task.alive) {
    return {
      ...base,
      group: 'running',
      meta: 'trabalhando',
      waitReason: null,
      since: session?.runningSince ?? task.startedAt,
    }
  }
  if (task.status === 'done' && !task.interrupted) {
    return {
      ...base,
      group: 'review',
      meta: 'terminou',
      waitReason: null,
      since: task.endedAt ?? task.startedAt,
    }
  }
  const meta = task.interrupted
    ? 'interrompido'
    : task.status === 'error'
      ? `erro${task.exitCode !== null ? ` (código ${task.exitCode})` : ''}`
      : 'parado'
  return {
    ...base,
    group: 'idle',
    meta,
    waitReason: null,
    since: task.endedAt ?? task.startedAt,
  }
}

function sessionItem(s: AgentSession, now: number): AttentionItem | null {
  const base = {
    id: `session:${s.id}`,
    key: basename(s.cwd) || tildePath(s.cwd),
    name: s.firstPrompt ?? 'Claude Code',
    session: s,
    task: null,
    inKite: s.ptyId !== null,
  }
  if (s.status === 'waiting' && s.waitReason) {
    return {
      ...base,
      group: 'waiting',
      meta: WAIT_LABEL[s.waitReason],
      waitReason: s.waitReason,
      since: s.waitingSince ?? s.lastEventAt,
    }
  }
  if (s.status === 'running') {
    return {
      ...base,
      group: 'running',
      meta: 'trabalhando',
      waitReason: null,
      since: s.runningSince ?? s.lastEventAt,
    }
  }
  if (s.status === 'ended' && s.touchedCount > 0 && now - (s.endedAt ?? 0) < REVIEW_WINDOW_MS) {
    return {
      ...base,
      group: 'review',
      meta: 'terminou',
      waitReason: null,
      since: s.endedAt ?? s.lastEventAt,
    }
  }
  // Ociosa (ainda sem pedido) ou encerrada sem mudanças: fica só na tela de conectar.
  return null
}

export function attentionItems(
  sessions: AgentSession[],
  tasks: AgentTask[],
  now: number,
): AttentionItem[] {
  const byTask = new Map<string, AgentSession>()
  for (const s of sessions) {
    if (!s.agentTaskId) continue
    const prev = byTask.get(s.agentTaskId)
    if (!prev || s.lastEventAt > prev.lastEventAt) byTask.set(s.agentTaskId, s)
  }
  const known = new Set(tasks.map((t) => t.id))
  const items = tasks.map((t) => taskItem(t, byTask.get(t.id)))
  for (const s of sessions) {
    if (s.agentTaskId && known.has(s.agentTaskId)) continue
    const item = sessionItem(s, now)
    if (item) items.push(item)
  }
  return items
}

// Quem espera há mais tempo primeiro; nos demais grupos, o mais recente primeiro.
export function groupItems(items: AttentionItem[]): Record<AttentionGroup, AttentionItem[]> {
  const groups: Record<AttentionGroup, AttentionItem[]> = {
    waiting: [],
    running: [],
    review: [],
    idle: [],
  }
  for (const item of items) groups[item.group].push(item)
  groups.waiting.sort((a, b) => a.since - b.since)
  for (const g of ['running', 'review', 'idle'] as const)
    groups[g].sort((a, b) => b.since - a.since)
  return groups
}

// Próximo que espera depois de `current` (Ctrl+J), voltando ao primeiro no fim.
export function nextWaiting(items: AttentionItem[], current: string | null): AttentionItem | null {
  const waiting = groupItems(items).waiting
  if (waiting.length === 0) return null
  const i = waiting.findIndex((x) => x.id === current)
  return waiting[(i + 1) % waiting.length] ?? null
}

// "há 6 min", "há 2 h", "agora".
export function ago(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `há ${h} h` : `há ${Math.floor(h / 24)} d`
}

// "2 min", "1 h 05 min".
export function elapsed(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

function rel(file: string, cwd: string): string {
  return file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : tildePath(file)
}

// O que um agente que trabalha está fazendo, a partir da última ferramenta.
export function doing(item: AttentionItem): string {
  const s = item.session
  const act = s?.activity
  if (!s || !act) return item.task && !s ? 'Trabalhando no terminal' : 'Pensando'
  const d = act.detail
  switch (act.tool) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return d ? `Editando ${rel(d, s.cwd)}` : 'Editando arquivos'
    case 'Read':
      return d ? `Lendo ${rel(d, s.cwd)}` : 'Lendo arquivos'
    case 'Bash':
      return d ? `Rodando ${d}` : 'Rodando um comando'
    case 'Grep':
    case 'Glob':
      return 'Buscando no código'
    case 'WebFetch':
    case 'WebSearch':
      return 'Pesquisando na web'
    case 'Task':
    case 'Agent':
      return 'Delegando a um subagente'
    default:
      return `Usando ${act.tool}`
  }
}

export function chipLabel(item: AttentionItem): string {
  if (item.waitReason === 'permission') return 'Pede permissão'
  if (item.waitReason === 'input') return 'Precisa de resposta'
  if (item.waitReason === 'turn') return 'Sua vez'
  return 'Esperando'
}

function clock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "Claude Code · iniciado 10:42 em ~/projetos/loja" ou "… · rodando fora do Kite".
export function origin(item: AttentionItem): string {
  if (item.task) {
    return `${item.task.presetName} · iniciado ${clock(item.task.startedAt)} em ${tildePath(item.task.worktreePath)}`
  }
  const s = item.session
  if (!s) return ''
  return item.inKite
    ? `Claude Code · iniciado ${clock(s.startedAt)} em ${tildePath(s.cwd)}`
    : 'Claude Code · rodando fora do Kite'
}
