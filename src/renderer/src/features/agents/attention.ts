import type { AgentSession, AgentTask, Task, WaitReason } from '@shared/types'
import { basename } from '../../lib/paths'
import { CLI_LABEL } from '../../lib/agent-cli'
import { tildePath } from '../../lib/session-format'
import type { TFunction } from '@shared/i18n'
import { t as currentT } from '../../lib/i18n'

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
  return currentT(`agents.group.${group}`)
}

export const GROUP_ORDER: AttentionGroup[] = ['waiting', 'running', 'review', 'idle']

function waitLabel(reason: WaitReason, tr: TFunction): string {
  return tr(`agents.session.${reason}`)
}

// Sessões encerradas só interessam se mexeram em algo; somem depois desse tempo.
const REVIEW_WINDOW_MS = 12 * 60 * 60 * 1000

// O que tira um item de "Para revisar" antes da hora: arquivos editados que já não têm
// alterações (commitados ou descartados) e itens dispensados pelo usuário.
export interface ReviewFilter {
  // Arquivos editados ainda não commitados, por sessão. A sessão só entra depois de conferida
  // (nada de piscar na lista ao abrir o Kite); null não filtra por isso.
  pending: Record<string, number> | null
  dismissed: Set<string>
}

const NO_FILTER: ReviewFilter = { pending: null, dismissed: new Set() }

// Sessão encerrada que mexeu em arquivos há pouco tempo: vale conferir se ainda há o que revisar.
export function reviewCandidate(s: AgentSession, now: number): boolean {
  return s.status === 'ended' && s.touchedCount > 0 && now - (s.endedAt ?? 0) < REVIEW_WINDOW_MS
}

function inReview(s: AgentSession, now: number, f: ReviewFilter): boolean {
  const pending = f.pending === null || (f.pending[s.id] ?? 0) > 0
  return reviewCandidate(s, now) && pending && !f.dismissed.has(sessionKey(s))
}

const sessionKey = (s: AgentSession) => `session:${s.id}`
const agentKey = (a: AgentTask) => `task:${a.id}:${a.endedAt ?? 0}`

// Chave para dispensar um item de "Para revisar": a sessão ou o agente que o pôs ali.
export function reviewKey(item: AttentionItem): string | null {
  if (item.group !== 'review') return null
  if (item.wsTask) {
    if (item.session) return sessionKey(item.session)
    return item.task ? agentKey(item.task) : null
  }
  if (item.task) return agentKey(item.task)
  return item.session ? sessionKey(item.session) : null
}

function taskItem(
  task: AgentTask,
  session: AgentSession | undefined,
  f: ReviewFilter,
  tr: TFunction,
): AttentionItem {
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
      meta: reason ? waitLabel(reason, tr) : tr('agents.meta.waiting'),
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
  if (task.status === 'done' && !task.interrupted && !f.dismissed.has(agentKey(task))) {
    return {
      ...base,
      group: 'review',
      meta: tr('agents.meta.done'),
      waitReason: null,
      since: task.endedAt ?? task.startedAt,
    }
  }
  const meta = agentLabel(task, tr)
  return {
    ...base,
    group: 'idle',
    meta,
    waitReason: null,
    since: task.endedAt ?? task.startedAt,
  }
}

function sessionItem(
  s: AgentSession,
  now: number,
  f: ReviewFilter,
  tr: TFunction,
): AttentionItem | null {
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
      meta: waitLabel(s.waitReason, tr),
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
  if (inReview(s, now, f)) {
    return {
      ...base,
      group: 'review',
      meta: tr('agents.meta.done'),
      waitReason: null,
      since: s.endedAt ?? s.lastEventAt,
    }
  }
  // Ociosa (ainda sem pedido), encerrada sem mudanças ou já revisada: fica só na tela de conectar.
  return null
}

function agentLabel(a: AgentTask, tr: TFunction): string {
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
  f: ReviewFilter,
  tr: TFunction,
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
      waitLabel(waiting.waitReason, tr),
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
  const ended = linked.find((s) => inReview(s, now, f))
  if (ended)
    return item(
      'review',
      tr('agents.meta.done'),
      ended.endedAt ?? ended.lastEventAt,
      ended,
      agentOf(ended),
    )
  const lastAgent = [...agents].sort((a, b) => b.startedAt - a.startedAt)[0]
  if (
    lastAgent?.status === 'done' &&
    !lastAgent.interrupted &&
    !f.dismissed.has(agentKey(lastAgent))
  ) {
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
      agentLabel(lastAgent, tr),
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
  f: ReviewFilter = NO_FILTER,
  // Rótulos no idioma dado; o hook passa o do usuário para recalcular quando ele muda.
  tr: TFunction = currentT,
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
  const items = standalone.map((t) => taskItem(t, byTask.get(t.id), f, tr))
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
    items.push(wsTaskItem(t, linkedTo.get(t.id) ?? [], agents, now, f, tr))
  }
  for (const s of free) {
    const id = taskOf(s)
    if (id && visible.has(id)) continue
    const item = sessionItem(s, now, f, tr)
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
  if (min < 1) return currentT('agents.ago.now')
  if (min < 60) return currentT('agents.ago.min', { n: min })
  const h = Math.floor(min / 60)
  return h < 24
    ? currentT('agents.ago.hours', { n: h })
    : currentT('agents.ago.days', { n: Math.floor(h / 24) })
}

// "2 min", "1 h 05 min".
export function elapsed(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return currentT('agents.ago.now')
  if (min < 60) return currentT('agents.elapsed.min', { n: min })
  return currentT('agents.elapsed.hours', {
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
  if (!s || !act)
    return item.task && !s ? currentT('agents.doing.terminal') : currentT('agents.doing.thinking')
  const d = act.detail
  switch (act.tool) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return d
        ? currentT('agents.doing.editing', { file: rel(d, s.cwd) })
        : currentT('agents.doing.editingFiles')
    case 'Read':
      return d
        ? currentT('agents.doing.reading', { file: rel(d, s.cwd) })
        : currentT('agents.doing.readingFiles')
    case 'Bash':
      return d
        ? currentT('agents.doing.running', { command: d })
        : currentT('agents.doing.runningCommand')
    case 'Grep':
    case 'Glob':
      return currentT('agents.doing.searching')
    case 'WebFetch':
    case 'WebSearch':
      return currentT('agents.doing.web')
    case 'Task':
    case 'Agent':
      return currentT('agents.doing.delegating')
    default:
      return currentT('agents.doing.using', { tool: act.tool })
  }
}

export function chipLabel(item: AttentionItem): string {
  if (item.waitReason === 'permission') return currentT('agents.chip.permission')
  if (item.waitReason === 'input') return currentT('agents.chip.input')
  if (item.waitReason === 'turn') return currentT('agents.chip.turn')
  return currentT('agents.chip.waiting')
}

function clock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "Claude Code · iniciado 10:42 em ~/projetos/loja" ou "… · rodando fora do Kite".
export function origin(item: AttentionItem): string {
  if (item.task) {
    return currentT('agents.origin.started', {
      who: item.task.presetName,
      time: clock(item.task.startedAt),
      where: tildePath(item.task.worktreePath),
    })
  }
  const s = item.session
  if (!s) return ''
  return item.inKite
    ? currentT('agents.origin.started', {
        who: CLI_LABEL[s.cli],
        time: clock(s.startedAt),
        where: tildePath(s.cwd),
      })
    : currentT('agents.origin.outside', { who: CLI_LABEL[s.cli] })
}
