import type { AgentCli } from '@shared/types'
import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { AgentEventService } from '../services/agent-events.service'
import type { HooksService } from '../services/hooks.service'
import { registerHandler } from './register'

const cli = z.enum(['claude', 'codex', 'gemini'])

export function registerAgentSessionIpc(
  events: AgentEventService,
  hooks: Record<AgentCli, HooksService>,
  log: Logger,
): void {
  registerHandler('agentSession:list', z.tuple([]), () => events.list(), log)
  registerHandler('hooks:status', z.tuple([cli]), (c) => hooks[c].status(), log)
  registerHandler('hooks:install', z.tuple([cli]), (c) => hooks[c].install(), log)
  registerHandler('hooks:uninstall', z.tuple([cli]), (c) => hooks[c].uninstall(), log)
}
