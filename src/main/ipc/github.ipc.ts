import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { GitHubAuthService } from '../services/github-auth.service'
import type { GitHubService } from '../services/github.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const state = z.enum(['open', 'closed', 'all'])
const number = z.number().int().positive()
const createInput = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().max(65_536),
  base: z.string().min(1).max(200),
  draft: z.boolean(),
})

export function registerGitHubIpc(
  auth: GitHubAuthService,
  github: GitHubService,
  log: Logger,
): void {
  registerHandler('github:me', z.tuple([]), () => auth.state(), log)
  registerHandler('github:startDeviceFlow', z.tuple([]), () => auth.startDeviceFlow(), log)
  registerHandler(
    'github:pollDeviceFlow',
    z.tuple([z.string().uuid()]),
    (id) => auth.pollDeviceFlow(id),
    log,
  )
  registerHandler('github:logout', z.tuple([]), () => auth.logout(), log)
  registerHandler('github:repo', z.tuple([absPath]), (r) => github.repo(r), log)
  registerHandler('github:listPRs', z.tuple([absPath, state]), (r, s) => github.listPRs(r, s), log)
  registerHandler(
    'github:listIssues',
    z.tuple([absPath, state]),
    (r, s) => github.listIssues(r, s),
    log,
  )
  registerHandler('github:getPR', z.tuple([absPath, number]), (r, n) => github.getPR(r, n), log)
  registerHandler(
    'github:getIssue',
    z.tuple([absPath, number]),
    (r, n) => github.getIssue(r, n),
    log,
  )
  registerHandler(
    'github:createPR',
    z.tuple([absPath, createInput]),
    (r, i) => github.createPR(r, i),
    log,
  )
  registerHandler(
    'github:checkoutPR',
    z.tuple([absPath, number]),
    (r, n) => github.checkoutPR(r, n),
    log,
  )
}
