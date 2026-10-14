import path from 'node:path'
import type { PtyDataEvent, PtyExitEvent } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../lib/logger'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { PtyService, type PtyProcess, type SpawnFn } from './pty.service'

class FakePty implements PtyProcess {
  readonly pid = 4242
  dataListeners: ((d: string) => void)[] = []
  exitListeners: ((e: { exitCode: number }) => void)[] = []
  written: string[] = []
  size: [number, number] | null = null
  killed = false
  onData(l: (d: string) => void) {
    this.dataListeners.push(l)
  }
  onExit(l: (e: { exitCode: number }) => void) {
    this.exitListeners.push(l)
  }
  write(d: string) {
    this.written.push(d)
  }
  resize(c: number, r: number) {
    this.size = [c, r]
  }
  kill() {
    this.killed = true
  }
  emit(d: string) {
    this.dataListeners.forEach((l) => l(d))
  }
  exit(code: number) {
    this.exitListeners.forEach((l) => l({ exitCode: code }))
  }
}

describe('PtyService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  let fake: FakePty
  let spawn: ReturnType<typeof vi.fn<SpawnFn>>
  let emitData: ReturnType<typeof vi.fn<(e: PtyDataEvent) => void>>
  let emitExit: ReturnType<typeof vi.fn<(e: PtyExitEvent) => void>>
  let service: PtyService

  beforeEach(async () => {
    ;({ dir, cleanup } = await makeTree({ 'ws/src/': '', 'fora/': '' }))
    const guard = new WorkspaceGuard()
    await guard.addRoot(path.join(dir, 'ws'))
    fake = new FakePty()
    spawn = vi.fn<SpawnFn>(() => fake)
    emitData = vi.fn<(e: PtyDataEvent) => void>()
    emitExit = vi.fn<(e: PtyExitEvent) => void>()
    service = new PtyService({
      guard,
      spawn,
      shell: { file: '/bin/bash', args: [] },
      allowedShells: async () => ['/bin/bash', '/usr/bin/zsh'],
      baseEnv: { PATH: '/bin', ELECTRON_RENDERER_URL: 'x' },
      emitData,
      emitExit,
      log: createLogger('test', 'error', () => {}),
      flushMs: 1,
    })
  })
  afterEach(() => cleanup())

  const create = (extra: object = {}) =>
    service.create({ cwd: path.join(dir, 'ws', 'src'), cols: 80, rows: 24, ...extra })

  it('cria o pty com o shell padrão, cwd e env limpo', async () => {
    const { id, pid } = await create({ env: { FOO: '1' } })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(pid).toBe(4242)
    const [file, args, opts] = spawn.mock.calls[0] ?? []
    expect(file).toBe('/bin/bash')
    expect(args).toEqual([])
    expect(opts).toMatchObject({ cols: 80, rows: 24, cwd: path.join(dir, 'ws', 'src') })
    expect(opts?.env).toMatchObject({ PATH: '/bin', FOO: '1', TERM: 'xterm-256color' })
    expect(opts?.env).not.toHaveProperty('ELECTRON_RENDERER_URL')
  })

  it('recusa cwd fora do workspace', async () => {
    await expect(create({ cwd: path.join(dir, 'fora') })).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    expect(spawn).not.toHaveBeenCalled()
  })

  it('só aceita shells da lista permitida', async () => {
    await expect(create({ shell: '/tmp/malicioso' })).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    await create({ shell: '/usr/bin/zsh' })
    expect(spawn.mock.calls[0]?.[0]).toBe('/usr/bin/zsh')
  })

  it('agrupa a saída antes de emitir', async () => {
    const { id } = await create()
    fake.emit('a')
    fake.emit('b')
    fake.emit('c')
    expect(emitData).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 10))
    expect(emitData).toHaveBeenCalledTimes(1)
    expect(emitData).toHaveBeenCalledWith({ id, data: 'abc', end: 3 })
    fake.emit('de')
    await new Promise((r) => setTimeout(r, 10))
    expect(emitData).toHaveBeenLastCalledWith({ id, data: 'de', end: 5 })
  })

  it('repassa escrita e resize', async () => {
    const { id } = await create()
    service.write(id, 'ls\r')
    service.resize(id, 120, 40)
    expect(fake.written).toEqual(['ls\r'])
    expect(fake.size).toEqual([120, 40])
  })

  it('emite a saída pendente e o exit quando o processo termina', async () => {
    const { id } = await create()
    fake.emit('tchau')
    fake.exit(3)
    expect(emitData).toHaveBeenCalledWith({ id, data: 'tchau', end: 5 })
    expect(emitExit).toHaveBeenCalledWith({ id, exitCode: 3 })
    expect(service.count()).toBe(0)
    expect(() => service.write(id, 'x')).toThrow()
  })

  it('spawnAt roda um comando arbitrário sem exigir pasta aberta', async () => {
    const { id } = service.spawnAt({
      cwd: path.join(dir, 'fora'),
      file: '/bin/sh',
      args: ['-c', 'true'],
      cols: 80,
      rows: 24,
    })
    expect(spawn.mock.calls[0]?.[0]).toBe('/bin/sh')
    expect(spawn.mock.calls[0]?.[2]).toMatchObject({ cwd: path.join(dir, 'fora') })
    expect(service.has(id)).toBe(true)
  })

  it('killAll encerra todos os processos', async () => {
    await create()
    await create()
    service.killAll()
    expect(fake.killed).toBe(true)
    expect(service.count()).toBe(0)
  })
})
