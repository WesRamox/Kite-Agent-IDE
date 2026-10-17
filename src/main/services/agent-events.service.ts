import { mkdir, open, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { AgentSession } from '@shared/types'
import { hookRecordSchema, reduceSession } from '../lib/agent-session'
import type { HookRecord } from '../lib/hook-record'
import type { Logger } from '../lib/logger'
import type { SubscribeFn, Subscription } from './watch.service'

export interface AgentEventServiceDeps {
  // userData/agent-events: um .jsonl por sessão, escrito pelo kite-hook.
  spoolDir: string
  subscribe: SubscribeFn
  emit: (session: AgentSession) => void
  // A sessão passou a esperar o usuário (notificação nativa).
  onWaiting: (session: AgentSession) => void
  // Sessão de um agente aberto pelo Kite (ainda rodando): o status dos hooks substitui a
  // heurística do terminal e a notificação fica a cargo do AgentService.
  isLiveAgent: (agentTaskId: string) => boolean
  onAgentStatus: (agentTaskId: string, status: 'running' | 'waiting') => void
  log: Logger
  now?: () => number
  // Arquivos de sessões sem eventos há mais tempo que isso são apagados.
  retentionMs?: number
  // Sessões encerradas há mais tempo que isso saem da lista.
  endedVisibleMs?: number
}

const DAY = 24 * 60 * 60 * 1000

// Lê o spool de eventos dos hooks e mantém o estado de cada sessão de agente.
export class AgentEventService {
  private readonly sessions = new Map<string, AgentSession>()
  // Quanto de cada arquivo já foi lido, e a linha incompleta que sobrou.
  private readonly offsets = new Map<string, { pos: number; rest: string }>()
  private readonly reading = new Map<string, Promise<void>>()
  private sub: Subscription | null = null

  constructor(private readonly deps: AgentEventServiceDeps) {}

  async init(): Promise<void> {
    const { spoolDir } = this.deps
    await mkdir(spoolDir, { recursive: true, mode: 0o700 })
    const retention = this.deps.retentionMs ?? 7 * DAY
    for (const name of await readdir(spoolDir)) {
      if (!name.endsWith('.jsonl')) continue
      const file = path.join(spoolDir, name)
      const info = await stat(file).catch(() => null)
      if (!info) continue
      if (this.now() - info.mtimeMs > retention) {
        await unlink(file).catch(() => {})
        continue
      }
      await this.readNew(file, false)
    }
    this.sub = await this.deps.subscribe(
      spoolDir,
      (err, events) => {
        if (err) {
          this.deps.log.warn('erro no watcher do spool de agentes', { error: err.message })
          return
        }
        for (const e of events) {
          if (e.type !== 'delete' && e.path.endsWith('.jsonl')) void this.queueRead(e.path)
        }
      },
      { ignore: [] },
    )
  }

  list(): AgentSession[] {
    const visible = this.deps.endedVisibleMs ?? 12 * 60 * 60 * 1000
    const now = this.now()
    return [...this.sessions.values()]
      .filter((s) => s.status !== 'ended' || now - (s.endedAt ?? 0) < visible)
      .sort((a, b) => b.lastEventAt - a.lastEventAt)
  }

  async dispose(): Promise<void> {
    await this.sub?.unsubscribe()
    this.sub = null
  }

  // Leituras do mesmo arquivo em série (eventos do watcher chegam em rajadas).
  private queueRead(file: string): Promise<void> {
    const prev = this.reading.get(file) ?? Promise.resolve()
    const next = prev.then(() => this.readNew(file, true))
    this.reading.set(
      file,
      next.catch(() => {}),
    )
    return next
  }

  private async readNew(file: string, live: boolean): Promise<void> {
    const state = this.offsets.get(file) ?? { pos: 0, rest: '' }
    let text: string
    try {
      const fh = await open(file, 'r')
      try {
        const { size } = await fh.stat()
        if (size < state.pos) Object.assign(state, { pos: 0, rest: '' }) // arquivo recriado
        if (size === state.pos) return
        const buf = Buffer.alloc(size - state.pos)
        await fh.read(buf, 0, buf.length, state.pos)
        state.pos = size
        text = state.rest + buf.toString('utf8')
      } finally {
        await fh.close()
      }
    } catch (err) {
      this.deps.log.warn('não foi possível ler eventos de agente', {
        error: (err as Error).message,
      })
      return
    }
    const lines = text.split('\n')
    state.rest = lines.pop() ?? ''
    this.offsets.set(file, state)
    for (const line of lines) {
      if (!line.trim()) continue
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }
      const rec = hookRecordSchema.safeParse(parsed)
      if (rec.success) this.apply(rec.data, live)
    }
  }

  private apply(rec: HookRecord, live: boolean): void {
    const prev = this.sessions.get(rec.sessionId)
    const next = reduceSession(prev, rec)
    this.sessions.set(next.id, next)
    if (!live) return
    this.deps.emit(next)
    const startedWaiting =
      next.status === 'waiting' &&
      (prev?.status !== 'waiting' || prev.waitReason !== next.waitReason)
    if (next.agentTaskId && this.deps.isLiveAgent(next.agentTaskId)) {
      if (next.status === 'running' && prev?.status !== 'running') {
        this.deps.onAgentStatus(next.agentTaskId, 'running')
      } else if (startedWaiting) {
        this.deps.onAgentStatus(next.agentTaskId, 'waiting')
      }
    } else if (startedWaiting) {
      this.deps.onWaiting(next)
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }
}
