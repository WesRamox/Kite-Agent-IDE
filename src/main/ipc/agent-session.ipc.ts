import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { AgentEventService } from '../services/agent-events.service'
import type { HooksService } from '../services/hooks.service'
import { registerHandler } from './register'

export function registerAgentSessionIpc(
  events: AgentEventService,
  hooks: HooksService,
  log: Logger,
): void {
  registerHandler('agentSession:list', z.tuple([]), () => events.list(), log)
  registerHandler('hooks:status', z.tuple([]), () => hooks.status(), log)
  registerHandler('hooks:install', z.tuple([]), () => hooks.install(), log)
  registerHandler('hooks:uninstall', z.tuple([]), () => hooks.uninstall(), log)
}
