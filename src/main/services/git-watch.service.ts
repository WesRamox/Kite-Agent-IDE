import type { GitChangedEvent } from '@shared/types'
import { AppException } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { SubscribeFn, Subscription } from './watch.service'

export interface GitWatchDeps {
  gitDirs: (root: string) => Promise<string[]>
  subscribe: SubscribeFn
  emit: (event: GitChangedEvent) => void
  log: Logger
  debounceMs?: number
}

// O watcher de arquivos ignora `.git`; este observa só o que muda o estado do repositório
// (HEAD, index, refs), para o painel acompanhar commits e checkouts feitos no terminal.
const IGNORE = ['objects/**', 'logs/**', 'hooks/**', 'lfs/**', '**/*.lock']

interface Entry {
  subs: Subscription[]
  timer: ReturnType<typeof setTimeout> | null
}

export class GitWatchService {
  private readonly entries = new Map<string, Promise<Entry | null>>()

  constructor(private readonly deps: GitWatchDeps) {}

  async watch(root: string): Promise<void> {
    if (this.entries.has(root)) return
    const pending = this.start(root)
    this.entries.set(root, pending)
    if (!(await pending)) this.entries.delete(root)
  }

  async unwatch(root: string): Promise<void> {
    const pending = this.entries.get(root)
    if (!pending) return
    this.entries.delete(root)
    const entry = await pending
    if (!entry) return
    if (entry.timer) clearTimeout(entry.timer)
    await Promise.allSettled(entry.subs.map((s) => s.unsubscribe()))
  }

  async unwatchAll(): Promise<void> {
    await Promise.allSettled([...this.entries.keys()].map((r) => this.unwatch(r)))
  }

  private async start(root: string): Promise<Entry | null> {
    let dirs: string[]
    try {
      dirs = await this.deps.gitDirs(root)
    } catch (err) {
      if (err instanceof AppException && err.code === 'NOT_A_REPO') return null
      throw err
    }
    const entry: Entry = { subs: [], timer: null }
    const fire = (err: Error | null) => {
      if (err) {
        this.deps.log.warn('erro no watcher do git', { error: err.message })
        return
      }
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        entry.timer = null
        this.deps.emit({ root })
      }, this.deps.debounceMs ?? 150)
    }
    for (const dir of dirs) {
      entry.subs.push(await this.deps.subscribe(dir, (err) => fire(err), { ignore: IGNORE }))
    }
    return entry
  }
}
