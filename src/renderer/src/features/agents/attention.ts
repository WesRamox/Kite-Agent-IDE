import type { AgentSession, AgentTask, Task, WaitReason } from '@shared/types'
import { basename } from '../../lib/paths'
import { CLI_LABEL } from './cli'
import { tildePath } from './session-format'
import { t as tr } from '../../lib/i18n'

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
  // Agente aberto pelo Kite (Fase 5).
  task: AgentTask | null
  // Tarefa multi-repo do workspace (Fase 8) e todas as sessões ligadas a ela.
  wsTask: Task | null
  sessions: AgentSession[]
  // Roda num terminal do Kite: dá para responder ali mesmo.
  inKite: boolean
}

// Rótulo curto só quando acrescenta algo ao nome (tarefa sem título: o nome já é o rótulo).
export function shortKey(item: AttentionItem): string {
  return item.key === item.name ? '' : item.key
}

export function groupLabel(group: AttentionGroup): string {
  return tr(`agents.group.${group}`)
}

export const GROUP_ORDER: AttentionGroup[] = ['waiting', 'running', 'review', 'idle']

function waitLabel(reason: WaitReason): string {
  return tr(`agents.session.${reason}`)
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
    wsTask: null,
    sessions: session ? [session] : [],
    inKite: true,
  }
  if (task.alive && task.status === 'waiting') {
    const reason = session?.status === 'waiting' ? session.waitReason : null
    return {
      ...base,
      group: 'waiting',
      meta: reason ? waitLabel(reason) : tr('agents.meta.waiting'),
      waitReason: reason,
      since: session?.waitingSince ?? session?.lastEventAt ?? task.startedAt,
    }
  }
  if (task.alive) {
    return {
      ...base,
      group: 'running',
      meta: tr('agents.meta.running'),
      waitReason: null,
      since: session?.runningSince ?? task.startedAt,
    }
  }
  if (task.status === 'done' && !task.interrupted) {
    return {
      ...base,
      group: 'review',
      meta: tr('agents.meta.done'),
      waitReason: null,
      since: task.endedAt ?? task.startedAt,
    }
  }
  const meta = agentLabel(task)
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
    name: s.firstPrompt ?? CLI_LABEL[s.cli],
    session: s,
    task: null,
    wsTask: null,
    sessions: [s],
    inKite: s.ptyId !== null,
  }
  if (s.status === 'waiting' && s.waitReason) {
    return {
      ...base,
      group: 'waiting',
      meta: waitLabel(s.waitReason),
      waitReason: s.waitReason,
      since: s.waitingSince ?? s.lastEventAt,
    }
  }
  if (s.status === 'running') {
    return {
      ...base,
      group: 'running',
      meta: tr('agents.meta.running'),
      waitReason: null,
      since: s.runningSince ?? s.lastEventAt,
    }
  }
  if (s.status === 'ended' && s.touchedCount > 0 && now - (s.endedAt ?? 0) < REVIEW_WINDOW_MS) {
    return {
      ...base,
      group: 'review',
      meta: tr('agents.meta.done'),
      waitReason: null,
      since: s.endedAt ?? s.lastEventAt,
    }
  }
  // Ociosa (ainda sem pedido) ou encerrada sem mudanças: fica só na tela de conectar.
  return null
}

function agentLabel(a: AgentTask): string {
  if (a.interrupted) return tr('agents.meta.interrupted')
  if (a.status === 'error') return tr('agents.meta.error', { code: a.exitCode })
  return tr('agents.meta.stopped')
}

// Tarefa do workspace: o estado vem da sessão ou do agente do Kite que mais pede atenção
// (espera > trabalha > terminou com mudanças). Sem nenhum, fica em "Sem agente".
function wsTaskItem(
  t: Task,
  linked: AgentSession[],
  agents: AgentTask[],
  now: number,
): AttentionItem {
  const repos = t.worktrees.map((w) => w.repoName).join(' · ')
  const agentOf = (s: AgentSession | undefined) =>
    s?.agentTaskId ? (agents.find((a) => a.id === s.agentTaskId) ?? null) : null
  const base = { id: `wstask:${t.id}`, key: t.key, name: t.name, wsTask: t, sessions: linked }
  const item = (
    group: AttentionGroup,
    label: string,
    since: number,
    session: AgentSession | null,
    agent: AgentTask | null,
    waitReason: WaitReason | null = null,
  ): AttentionItem => ({
    ...base,
    group,
    meta: label ? `${repos} — ${label}` : repos,
    waitReason,
    since,
    session,
    task: agent,
    inKite: agent !== null ? agent.alive : session?.ptyId != null,
  })

  const waiting = linked
    .filter((s) => s.status === 'waiting' && s.waitReason)
    .sort((a, b) => (a.waitingSince ?? 0) - (b.waitingSince ?? 0))[0]
  if (waiting?.waitReason) {
    return item(
      'waiting',
      waitLabel(waiting.waitReason),
      waiting.waitingSince ?? waiting.lastEventAt,
      waiting,
      agentOf(waiting),
      waiting.waitReason,
    )
  }
  // Agente do Kite sem hooks: a heurística do terminal diz que ele espera.
  const agentWaiting = agents.find((a) => a.alive && a.status === 'waiting')
  if (agentWaiting)
    return item('waiting', tr('agents.meta.waiting'), agentWaiting.startedAt, null, agentWaiting)
  const running = linked.find((s) => s.status === 'running')
  if (running) {
    return item(
      'running',
      tr('agents.meta.running'),
      running.runningSince ?? running.lastEventAt,
      running,
      agentOf(running),
    )
  }
  const agentRunning = agents.find((a) => a.alive)
  if (agentRunning)
    return item('running', tr('agents.meta.running'), agentRunning.startedAt, null, agentRunning)
  const ended = linked.find(
    (s) => s.status === 'ended' && s.touchedCount > 0 && now - (s.endedAt ?? 0) < REVIEW_WINDOW_MS,
  )
  if (ended)
    return item(
      'review',
      tr('agents.meta.done'),
      ended.endedAt ?? ended.lastEventAt,
      ended,
      agentOf(ended),
    )
  const lastAgent = [...agents].sort((a, b) => b.startedAt - a.startedAt)[0]
  if (lastAgent?.status === 'done' && !lastAgent.interrupted) {
    return item(
      'review',
      tr('agents.meta.done'),
      lastAgent.endedAt ?? lastAgent.startedAt,
      null,
      lastAgent,
    )
  }
  if (lastAgent) {
    return item(
      'idle',
      agentLabel(lastAgent),
      lastAgent.endedAt ?? lastAgent.startedAt,
      null,
      lastAgent,
    )
  }
  return item('idle', '', 0, null, null)
}

export function attentionItems(
  sessions: AgentSession[],
  tasks: AgentTask[],
  now: number,
  wsTasks: Task[] = [],
  links: Map<string, string> = new Map(),
): AttentionItem[] {
  const visible = new Set(wsTasks.map((t) => t.id))
  // Agentes abertos na pasta de uma tarefa (Fase 10) aparecem dentro do item dela.
  const inTask = (a: AgentTask) => a.wsTaskId !== undefined && visible.has(a.wsTaskId)
  const standalone = tasks.filter((a) => !inTask(a))
  const agentTask = new Map(tasks.filter(inTask).map((a) => [a.id, a.wsTaskId as string]))

  const byTask = new Map<string, AgentSession>()
  for (const s of sessions) {
    if (!s.agentTaskId) continue
    const prev = byTask.get(s.agentTaskId)
    if (!prev || s.lastEventAt > prev.lastEventAt) byTask.set(s.agentTaskId, s)
  }
  const known = new Set(standalone.map((t) => t.id))
  const items = standalone.map((t) => taskItem(t, byTask.get(t.id)))
  // Sessões de agentes do Kite ficam no item do agente; as demais vão para a tarefa ligada.
  const free = sessions.filter((s) => !(s.agentTaskId && known.has(s.agentTaskId)))
  const linkedTo = new Map<string, AgentSession[]>()
  const taskOf = (s: AgentSession): string | undefined =>
    (s.agentTaskId ? agentTask.get(s.agentTaskId) : undefined) ?? links.get(s.id)
  for (const s of free) {
    const id = taskOf(s)
    if (id && visible.has(id)) linkedTo.set(id, [...(linkedTo.get(id) ?? []), s])
  }
  for (const t of wsTasks) {
    const agents = tasks.filter((a) => a.wsTaskId === t.id)
    items.push(wsTaskItem(t, linkedTo.get(t.id) ?? [], agents, now))
  }
  for (const s of free) {
    const id = taskOf(s)
    if (id && visible.has(id)) continue
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
  if (min < 1) return tr('agents.ago.now')
  if (min < 60) return tr('agents.ago.min', { n: min })
  const h = Math.floor(min / 60)
  return h < 24
    ? tr('agents.ago.hours', { n: h })
    : tr('agents.ago.days', { n: Math.floor(h / 24) })
}

// "2 min", "1 h 05 min".
export function elapsed(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return tr('agents.ago.now')
  if (min < 60) return tr('agents.elapsed.min', { n: min })
  return tr('agents.elapsed.hours', {
    h: Math.floor(min / 60),
    min: String(min % 60).padStart(2, '0'),
  })
}

function rel(file: string, cwd: string): string {
  return file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : tildePath(file)
}

// O que um agente que trabalha está fazendo, a partir da última ferramenta.
export function doing(item: AttentionItem): string {
  const s = item.session
  const act = s?.activity
  if (!s || !act) return item.task && !s ? tr('agents.doing.terminal') : tr('agents.doing.thinking')
  const d = act.detail
  switch (act.tool) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return d
        ? tr('agents.doing.editing', { file: rel(d, s.cwd) })
        : tr('agents.doing.editingFiles')
    case 'Read':
      return d
        ? tr('agents.doing.reading', { file: rel(d, s.cwd) })
        : tr('agents.doing.readingFiles')
    case 'Bash':
      return d ? tr('agents.doing.running', { command: d }) : tr('agents.doing.runningCommand')
    case 'Grep':
    case 'Glob':
      return tr('agents.doing.searching')
    case 'WebFetch':
    case 'WebSearch':
      return tr('agents.doing.web')
    case 'Task':
    case 'Agent':
      return tr('agents.doing.delegating')
    default:
      return tr('agents.doing.using', { tool: act.tool })
  }
}

export function chipLabel(item: AttentionItem): string {
  if (item.waitReason === 'permission') return tr('agents.chip.permission')
  if (item.waitReason === 'input') return tr('agents.chip.input')
  if (item.waitReason === 'turn') return tr('agents.chip.turn')
  return tr('agents.chip.waiting')
}

function clock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "Claude Code · iniciado 10:42 em ~/projetos/loja" ou "… · rodando fora do Kite".
export function origin(item: AttentionItem): string {
  if (item.task) {
    return tr('agents.origin.started', {
      who: item.task.presetName,
      time: clock(item.task.startedAt),
      where: tildePath(item.task.worktreePath),
    })
  }
  const s = item.session
  if (!s) return ''
  return item.inKite
    ? tr('agents.origin.started', {
        who: CLI_LABEL[s.cli],
        time: clock(s.startedAt),
        where: tildePath(s.cwd),
      })
    : tr('agents.origin.outside', { who: CLI_LABEL[s.cli] })
}
