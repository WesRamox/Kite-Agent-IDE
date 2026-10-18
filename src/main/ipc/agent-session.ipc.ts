import type { AgentCli } from '@shared/types'
import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { AgentEventService } from '../services/agent-events.service'
import type { HooksService } from '../services/hooks.service'
import type { SessionReviewService } from '../services/session-review.service'
import { registerHandler } from './register'

const cli = z.enum(['claude', 'codex', 'gemini'])
const sessionId = z.string().min(1).max(200)
// Item de "Para revisar": session:<id>, task:<id> ou wstask:<id>.
const reviewKey = z.string().regex(/^(session|task|wstask):[^\0]{1,4200}$/)

export function registerAgentSessionIpc(
  events: AgentEventService,
  review: SessionReviewService,
  hooks: Record<AgentCli, HooksService>,
  log: Logger,
): void {
  registerHandler('agentSession:list', z.tuple([]), () => events.list(), log)
  registerHandler('agentSession:review', z.tuple([sessionId]), (i) => review.review(i), log)
  registerHandler(
    'agentSession:reviewDiff',
    z.tuple([sessionId, z.string().min(1).max(4096)]),
    (i, p) => review.diff(i, p),
    log,
  )
  registerHandler(
    'agentSession:pending',
    z.tuple([z.array(sessionId).max(200)]),
    (ids) => review.pendingCounts(ids),
    log,
  )
  registerHandler('review:dismissed', z.tuple([]), () => review.dismissed(), log)
  registerHandler('review:dismiss', z.tuple([reviewKey]), (k) => review.dismiss(k), log)
  registerHandler('hooks:status', z.tuple([cli]), (c) => hooks[c].status(), log)
  registerHandler('hooks:install', z.tuple([cli]), (c) => hooks[c].install(), log)
  registerHandler('hooks:uninstall', z.tuple([cli]), (c) => hooks[c].uninstall(), log)
}
