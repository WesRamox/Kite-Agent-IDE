import { describe, expect, it, vi } from 'vitest'
import { AppException } from '../lib/errors'
import { createLogger } from '../lib/logger'
import { GitWatchService } from './git-watch.service'
import type { SubscribeFn, WatchEvent } from './watch.service'

function setup(dirs: () => Promise<string[]>) {
  const callbacks: ((err: Error | null, events: WatchEvent[]) => unknown)[] = []
  const unsubscribe = vi.fn(async () => {})
  const subscribe = vi.fn<SubscribeFn>(async (_dir, fn) => {
    callbacks.push(fn)
    return { unsubscribe }
  })
  const emit = vi.fn()
  const svc = new GitWatchService({
    gitDirs: dirs,
    subscribe,
    emit,
    log: createLogger('t', 'error', () => {}),
    debounceMs: 5,
  })
  return { svc, subscribe, unsubscribe, emit, callbacks }
}

describe('GitWatchService', () => {
  it('observa os diretórios do git e emite com debounce', async () => {
    const s = setup(async () => ['/r/.git', '/main/.git'])
    await s.svc.watch('/r')
    expect(s.subscribe.mock.calls.map((c) => c[0])).toEqual(['/r/.git', '/main/.git'])
    s.callbacks[0]?.(null, [{ type: 'update', path: '/r/.git/index' }])
    s.callbacks[1]?.(null, [{ type: 'update', path: '/main/.git/refs/heads/x' }])
    await new Promise((r) => setTimeout(r, 20))
    expect(s.emit).toHaveBeenCalledTimes(1)
    expect(s.emit).toHaveBeenCalledWith({ root: '/r' })
  })

  it('ignora pastas que não são repositório', async () => {
    const s = setup(async () => {
      throw new AppException('NOT_A_REPO', 'x')
    })
    await expect(s.svc.watch('/r')).resolves.toBeUndefined()
    expect(s.subscribe).not.toHaveBeenCalled()
  })

  it('cancela as assinaturas', async () => {
    const s = setup(async () => ['/r/.git'])
    await s.svc.watch('/r')
    await s.svc.unwatchAll()
    expect(s.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
