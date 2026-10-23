import { z } from 'zod'
import type { Logger } from '../lib/logger'
import { MAX_SCAN_DEPTH, MIN_SCAN_DEPTH } from '../lib/task-config'
import type { TaskCompletionService } from '../services/task-completion.service'
import type { TaskService } from '../services/task.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const taskId = z.string().min(1).max(4200)
// Uma worktree ou o grupo sugerido na descoberta (as de uma mesma branch).
const worktrees = z.array(absPath).min(1).max(100)
const grouping = z.object({
  mode: z.enum(['auto', 'pattern', 'manual']),
  pattern: z.string().max(200),
})

export function registerTaskIpc(
  tasks: TaskService,
  completion: TaskCompletionService,
  log: Logger,
): void {
  registerHandler('task:discover', z.tuple([absPath]), (r) => tasks.discover(r), log)
  registerHandler('task:watch', z.tuple([absPath]), (r) => tasks.watch(r), log)
  registerHandler(
    'task:setScanDepth',
    z.tuple([absPath, z.number().int().min(MIN_SCAN_DEPTH).max(MAX_SCAN_DEPTH)]),
    (r, depth) => tasks.setScanDepth(r, depth),
    log,
  )
  registerHandler(
    'task:setGrouping',
    z.tuple([absPath, grouping]),
    (r, g) => tasks.setGrouping(r, g),
    log,
  )
  registerHandler(
    'task:rename',
    z.tuple([absPath, taskId, z.string().max(120)]),
    (r, id, name) => tasks.rename(r, id, name),
    log,
  )
  registerHandler(
    'task:move',
    z.tuple([absPath, worktrees, taskId]),
    (r, wts, target) => tasks.move(r, wts, target),
    log,
  )
  registerHandler(
    'task:ignore',
    z.tuple([absPath, worktrees]),
    (r, wts) => tasks.ignore(r, wts),
    log,
  )
  registerHandler(
    'task:import',
    z.tuple([absPath, z.array(taskId).max(500), z.array(taskId).max(500)]),
    (r, imported, dismissed) => tasks.importTasks(r, imported, dismissed),
    log,
  )
  registerHandler(
    'task:setHidden',
    z.tuple([absPath, taskId, z.boolean()]),
    (r, id, h) => tasks.setHidden(r, id, h),
    log,
  )
  registerHandler(
    'task:setNotes',
    z.tuple([absPath, taskId, z.string().max(20_000)]),
    (r, id, notes) => tasks.setNotes(r, id, notes),
    log,
  )
  registerHandler(
    'task:linkSession',
    z.tuple([absPath, z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), taskId.nullable()]),
    (r, s, id) => tasks.linkSession(r, s, id),
    log,
  )
  registerHandler('task:addExternalRepo', z.tuple([absPath]), (r) => tasks.addExternalRepo(r), log)
  registerHandler(
    'task:removeRepo',
    z.tuple([absPath, absPath]),
    (r, repo) => tasks.removeRepo(r, repo),
    log,
  )
  registerHandler(
    'task:restoreRepo',
    z.tuple([absPath, absPath]),
    (r, repo) => tasks.restoreRepo(r, repo),
    log,
  )
  registerHandler(
    'task:remove',
    z.tuple([absPath, taskId]),
    (r, id) => tasks.removeTask(r, id),
    log,
  )
  registerHandler(
    'task:setDone',
    z.tuple([absPath, taskId, z.boolean()]),
    (r, id, done) => completion.setDone(r, id, done),
    log,
  )
  registerHandler(
    'task:removeWorktrees',
    z.tuple([absPath, taskId, z.boolean()]),
    (r, id, force) => completion.removeWorktrees(r, id, force),
    log,
  )
  registerHandler(
    'task:openRepo',
    z.tuple([absPath, absPath]),
    (r, repo) => tasks.openRepo(r, repo),
    log,
  )
  registerHandler('task:open', z.tuple([absPath, taskId]), (r, id) => tasks.open(r, id), log)
  registerHandler(
    'task:create',
    z.tuple([
      absPath,
      z.object({
        name: z.string().trim().min(1).max(120),
        branch: z.string().trim().min(1).max(200),
        repos: z.array(absPath).min(1).max(50),
      }),
    ]),
    (r, input) => tasks.create(r, input),
    log,
  )
  registerHandler(
    'task:addRepo',
    z.tuple([absPath, taskId, absPath]),
    (r, id, repo) => tasks.addRepo(r, id, repo),
    log,
  )
}
