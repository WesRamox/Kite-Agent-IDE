import { createHash } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'
import type { TerminalSession } from '@shared/types'
import { AppException } from '../lib/errors'
import { JsonStore } from '../lib/json-store'
import type { WorkspaceGuard } from '../lib/workspace-guard'

export const MAX_SESSIONS = 20
export const MAX_SCROLLBACK_CHARS = 2_000_000

export const sessionSchema = z.object({
  title: z.string().max(200),
  scrollback: z.string().max(MAX_SCROLLBACK_CHARS),
})

const fileSchema = z.object({ sessions: z.array(sessionSchema).max(MAX_SESSIONS) })

// Guarda o scrollback dos terminais por workspace, para restaurar ao reabrir.
export class TerminalSessionService {
  constructor(
    private readonly guard: WorkspaceGuard,
    private readonly dir: string,
  ) {}

  async load(root: string): Promise<TerminalSession[]> {
    return (await this.store(root).read()).sessions
  }

  async save(root: string, sessions: TerminalSession[]): Promise<void> {
    await this.store(root).write({ sessions: sessions.slice(0, MAX_SESSIONS) })
  }

  private store(root: string): JsonStore<{ sessions: TerminalSession[] }> {
    if (!this.guard.isRoot(root)) throw new AppException('FORBIDDEN_PATH', 'Não é uma pasta aberta')
    const key = createHash('sha256').update(root).digest('hex').slice(0, 24)
    return new JsonStore(path.join(this.dir, `${key}.json`), fileSchema, { sessions: [] })
  }
}
