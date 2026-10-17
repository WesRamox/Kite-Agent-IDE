import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { TaskReviewService } from '../services/task-review.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const taskId = z.string().min(1).max(4200)
const branch = z.string().min(1).max(200)
const bases = z.record(absPath, branch)

export function registerReviewIpc(review: TaskReviewService, log: Logger): void {
  registerHandler(
    'review:task',
    z.tuple([absPath, taskId, bases]),
    (r, id, b) => review.review(r, id, b),
    log,
  )
  registerHandler(
    'review:diff',
    z.tuple([absPath, taskId, absPath, branch, z.string().min(1).max(4096)]),
    (r, id, wt, base, rel) => review.diff(r, id, wt, base, rel),
    log,
  )
  registerHandler(
    'review:changes',
    z.tuple([absPath, taskId]),
    (r, id) => review.changes(r, id),
    log,
  )
  registerHandler('review:prs', z.tuple([absPath, taskId]), (r, id) => review.prs(r, id), log)
  registerHandler(
    'review:deliver',
    z.tuple([
      absPath,
      taskId,
      z.object({
        worktrees: z.array(absPath).min(1).max(50),
        message: z.string().max(10_000),
        openPRs: z.boolean(),
        title: z.string().max(300),
        body: z.string().max(60_000),
        draft: z.boolean(),
        bases,
      }),
    ]),
    (r, id, input) => review.deliver(r, id, input),
    log,
  )
}
