import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '../lib/logger'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { WatchService, type SubscribeFn, type WatchEvent } from './watch.service'

async function setup() {
  const t = await makeTree({ 'a.txt': '' })
  const guard = new WorkspaceGuard()
  await guard.addRoot(t.dir)
  let callback: ((err: Error | null, events: WatchEvent[]) => unknown) | undefined
  const unsubscribe = vi.fn(async () => {})
  const subscribe = vi.fn<SubscribeFn>(async (_dir, fn) => {
    callback = fn
    return { unsubscribe }
  })
  const emit = vi.fn()
  const onGitignoreChanged = vi.fn()
  const service = new WatchService({
    guard,
    subscribe,
    emit,
    onGitignoreChanged,
    log: createLogger('test', 'error', () => {}),
  })
  const fire = (events: WatchEvent[]): unknown => callback?.(null, events)
  return { t, service, subscribe, unsubscribe, emit, onGitignoreChanged, fire }
}

describe('WatchService', () => {
  it('assina uma vez por raiz e repassa eventos', async () => {
    const s = await setup()
    await s.service.watch(s.t.dir)
    await s.service.watch(s.t.dir)
    expect(s.subscribe).toHaveBeenCalledTimes(1)
    s.fire([{ type: 'update', path: path.join(s.t.dir, 'a.txt') }])
    expect(s.emit).toHaveBeenCalledWith({
      root: s.t.dir,
      events: [{ type: 'update', path: path.join(s.t.dir, 'a.txt') }],
    })
    await s.t.cleanup()
  })

  it('avisa quando um .gitignore muda', async () => {
    const s = await setup()
    await s.service.watch(s.t.dir)
    s.fire([{ type: 'update', path: path.join(s.t.dir, '.gitignore') }])
    expect(s.onGitignoreChanged).toHaveBeenCalledWith(path.join(s.t.dir, '.gitignore'))
    await s.t.cleanup()
  })

  it('recusa pastas que não são raízes', async () => {
    const s = await setup()
    await expect(s.service.watch(path.join(s.t.dir, 'x'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    await s.t.cleanup()
  })

  it('cancela a assinatura em unwatchAll', async () => {
    const s = await setup()
    await s.service.watch(s.t.dir)
    await s.service.unwatchAll()
    expect(s.unsubscribe).toHaveBeenCalledTimes(1)
    expect(s.service.isWatching(s.t.dir)).toBe(false)
    await s.t.cleanup()
  })
})
