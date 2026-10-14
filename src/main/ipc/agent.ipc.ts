import { z } from 'zod'
import { presetSchema } from '../lib/agent-schemas'
import type { Logger } from '../lib/logger'
import type { AgentService } from '../services/agent.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const id = z.string().uuid()
const startInput = z.object({
  root: absPath,
  name: z.string().trim().min(1).max(80),
  presetId: z.string().min(1).max(40),
  prompt: z.string().max(20_000),
})

export function registerAgentIpc(agents: AgentService, log: Logger): void {
  registerHandler('agent:presets', z.tuple([]), () => agents.presets(), log)
  registerHandler(
    'agent:savePresets',
    z.tuple([z.array(presetSchema).max(30)]),
    (p) => agents.savePresets(p),
    log,
  )
  registerHandler('agent:list', z.tuple([]), () => agents.list(), log)
  registerHandler('agent:start', z.tuple([startInput]), (i) => agents.start(i), log)
  registerHandler('agent:stop', z.tuple([id]), (i) => agents.stop(i), log)
  registerHandler('agent:restart', z.tuple([id]), (i) => agents.restart(i), log)
  registerHandler('agent:remove', z.tuple([id, z.boolean()]), (i, w) => agents.remove(i, w), log)
  registerHandler('agent:attach', z.tuple([id]), (i) => agents.attach(i), log)
  registerHandler('agent:review', z.tuple([id]), (i) => agents.review(i), log)
  registerHandler(
    'agent:reviewDiff',
    z.tuple([id, z.string().min(1).max(4096)]),
    (i, p) => agents.reviewDiff(i, p),
    log,
  )
}
