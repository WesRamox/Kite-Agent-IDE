import path from 'node:path'
import type { FsChangedEvent, FsChangeType } from '@shared/types'
import { AppException } from '../lib/errors'
import { DEFAULT_IGNORED_NAMES } from '../lib/ignore-rules'
import type { Logger } from '../lib/logger'
import type { WorkspaceGuard } from '../lib/workspace-guard'

export interface WatchEvent {
  path: string
  type: FsChangeType
}

export interface Subscription {
  unsubscribe(): Promise<void>
}

// Assinatura compatível com @parcel/watcher.subscribe, injetada para testes.
export type SubscribeFn = (
  dir: string,
  fn: (err: Error | null, events: WatchEvent[]) => unknown,
  opts: { ignore: string[] },
) => Promise<Subscription>

export interface WatchServiceDeps {
  guard: WorkspaceGuard
  subscribe: SubscribeFn
  emit: (event: FsChangedEvent) => void
  onGitignoreChanged: (file: string) => void
  log: Logger
}

const IGNORE_GLOBS = DEFAULT_IGNORED_NAMES.map((name) => `**/${name}/**`)

export class WatchService {
  private readonly subs = new Map<string, Promise<Subscription>>()

  constructor(private readonly deps: WatchServiceDeps) {}

  async watch(root: string): Promise<void> {
    if (!this.deps.guard.isRoot(root)) {
      throw new AppException('FORBIDDEN_PATH', 'Não é uma pasta aberta')
    }
    if (this.subs.has(root)) return
    const sub = this.deps.subscribe(
      root,
      (err, events) => {
        if (err) {
          this.deps.log.warn('erro no watcher', { error: err.message })
          return
        }
        this.handle(root, events)
      },
      { ignore: IGNORE_GLOBS },
    )
    this.subs.set(root, sub)
    try {
      await sub
    } catch (err) {
      this.subs.delete(root)
      throw err
    }
  }

  async unwatch(root: string): Promise<void> {
    const sub = this.subs.get(root)
    if (!sub) return
    this.subs.delete(root)
    await (await sub).unsubscribe()
  }

  async unwatchAll(): Promise<void> {
    await Promise.allSettled([...this.subs.keys()].map((root) => this.unwatch(root)))
  }

  isWatching(root: string): boolean {
    return this.subs.has(root)
  }

  private handle(root: string, events: WatchEvent[]): void {
    for (const e of events) {
      if (path.basename(e.path) === '.gitignore') this.deps.onGitignoreChanged(e.path)
    }
    if (events.length > 0) {
      this.deps.emit({ root, events: events.map(({ type, path }) => ({ type, path })) })
    }
  }
}
