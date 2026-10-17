import { appendFile, mkdir, stat, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { HookRecord } from '../lib/hook-record'
import { createLogger } from '../lib/logger'
import { makeTree } from '../test/tmp'
import { AgentEventService } from './agent-events.service'
import type { SubscribeFn, WatchEvent } from './watch.service'

const line = (r: Partial<HookRecord> & { event: string; ts: number }) =>
  `${JSON.stringify({ v: 1, cli: 'claude', sessionId: 's-1', cwd: '/w', ...r })}\n`

async function setup(opts: { liveAgent?: boolean; now?: number } = {}) {
  const t = await makeTree({ 'spool/': '' })
  const spool = path.join(t.dir, 'spool')
  let callback: ((err: Error | null, events: WatchEvent[]) => unknown) | undefined
  const subscribe = vi.fn<SubscribeFn>(async (_dir, fn) => {
    callback = fn
    return { unsubscribe: async () => {} }
  })
  const emit = vi.fn()
  const onWaiting = vi.fn()
  const onAgentStatus = vi.fn()
  const service = new AgentEventService({
    spoolDir: spool,
    subscribe,
    emit,
    onWaiting,
    isLiveAgent: () => opts.liveAgent ?? false,
    onAgentStatus,
    log: createLogger('test', 'error', () => {}),
    now: () => opts.now ?? 10_000,
  })
  const file = path.join(spool, 's-1.jsonl')
  // Acrescenta linhas e avisa o serviço como o watcher faria; espera a leitura terminar.
  const write = async (text: string) => {
    await appendFile(file, text)
    callback?.(null, [{ type: 'update', path: file }])
    await vi.waitFor(() => expect(emit).toHaveBeenCalled())
  }
  return { t, spool, file, service, emit, onWaiting, onAgentStatus, write }
}

describe('AgentEventService', () => {
  it('reconstrói as sessões do spool ao iniciar, sem notificar', async () => {
    const s = await setup()
    await writeFile(
      s.file,
      line({ event: 'UserPromptSubmit', ts: 1 }) +
        line({ event: 'Stop', ts: 2, lastMessage: 'ok?' }),
    )
    await s.service.init()
    expect(s.service.list()).toMatchObject([{ id: 's-1', status: 'waiting', lastMessage: 'ok?' }])
    expect(s.emit).not.toHaveBeenCalled()
    expect(s.onWaiting).not.toHaveBeenCalled()
    await s.t.cleanup()
  })

  it('lê só as linhas novas, inclusive uma linha que chega em partes', async () => {
    const s = await setup()
    await s.service.init()
    await s.write(line({ event: 'UserPromptSubmit', ts: 1 }))
    expect(s.service.list()[0]?.status).toBe('running')
    s.emit.mockClear()
    const half = line({ event: 'PermissionRequest', ts: 2, tool: 'Bash', toolDetail: 'ls' })
    await appendFile(s.file, half.slice(0, 20))
    await s.write(half.slice(20))
    expect(s.service.list()[0]).toMatchObject({ status: 'waiting', waitReason: 'permission' })
    expect(s.onWaiting).toHaveBeenCalledTimes(1)
    await s.t.cleanup()
  })

  it('ignora linhas inválidas', async () => {
    const s = await setup()
    await s.service.init()
    await s.write('lixo\n{"v":9}\n' + line({ event: 'Stop', ts: 3 }))
    expect(s.service.list()).toHaveLength(1)
    await s.t.cleanup()
  })

  it('repassa o status ao agente do Kite em vez de notificar', async () => {
    const s = await setup({ liveAgent: true })
    await s.service.init()
    const agentId = '0f8fad5b-d9cb-469f-a165-70867728950e'
    await s.write(line({ event: 'UserPromptSubmit', ts: 1, agentId }))
    expect(s.onAgentStatus).toHaveBeenLastCalledWith(agentId, 'running')
    s.emit.mockClear()
    await s.write(line({ event: 'Stop', ts: 2, agentId }))
    expect(s.onAgentStatus).toHaveBeenLastCalledWith(agentId, 'waiting')
    expect(s.onWaiting).not.toHaveBeenCalled()
    await s.t.cleanup()
  })

  it('apaga spools sem eventos há mais de 7 dias', async () => {
    const now = Date.now()
    const s = await setup({ now })
    await mkdir(s.spool, { recursive: true })
    const old = path.join(s.spool, 'velha.jsonl')
    await writeFile(old, line({ event: 'Stop', ts: 1, sessionId: 'velha' }))
    await utimes(old, new Date(0), new Date(0))
    await writeFile(s.file, line({ event: 'SessionEnd', ts: now }))
    await s.service.init()
    expect(s.service.list().map((x) => x.id)).toEqual(['s-1'])
    await expect(stat(old)).rejects.toThrow()
    await s.t.cleanup()
  })
})
