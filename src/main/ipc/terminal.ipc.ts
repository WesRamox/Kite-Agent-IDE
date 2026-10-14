import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { PtyService } from '../services/pty.service'
import {
  MAX_SESSIONS,
  sessionSchema,
  type TerminalSessionService,
} from '../services/terminal-session.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const id = z.string().uuid()
const dim = z.number().int().min(1).max(2000)

const createSchema = z.object({
  cwd: absPath,
  shell: absPath.optional(),
  cols: dim,
  rows: dim,
  env: z.record(z.string().max(256), z.string().max(32_768)).optional(),
})

export function registerTerminalIpc(
  pty: PtyService,
  sessions: TerminalSessionService,
  log: Logger,
): void {
  registerHandler('pty:create', z.tuple([createSchema]), (o) => pty.create(o), log)
  registerHandler(
    'pty:write',
    z.tuple([id, z.string().max(1_000_000)]),
    (i, d) => pty.write(i, d),
    log,
  )
  registerHandler('pty:resize', z.tuple([id, dim, dim]), (i, c, r) => pty.resize(i, c, r), log)
  registerHandler('pty:kill', z.tuple([id]), (i) => pty.kill(i), log)
  registerHandler('terminal:loadSessions', z.tuple([absPath]), (root) => sessions.load(root), log)
  registerHandler(
    'terminal:saveSessions',
    z.tuple([absPath, z.array(sessionSchema).max(MAX_SESSIONS)]),
    (root, list) => sessions.save(root, list),
    log,
  )
}
