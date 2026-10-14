import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { GitWatchService } from '../services/git-watch.service'
import type { GitService } from '../services/git.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const paths = z.array(absPath).min(1).max(5000)
const branch = z.string().min(1).max(200)

export function registerGitIpc(git: GitService, watch: GitWatchService, log: Logger): void {
  registerHandler('git:status', z.tuple([absPath]), (r) => git.status(r), log)
  registerHandler(
    'git:diff',
    z.tuple([absPath, absPath, z.boolean()]),
    (r, p, s) => git.diff(r, p, s),
    log,
  )
  registerHandler('git:stage', z.tuple([absPath, paths]), (r, p) => git.stage(r, p), log)
  registerHandler('git:unstage', z.tuple([absPath, paths]), (r, p) => git.unstage(r, p), log)
  registerHandler(
    'git:commit',
    z.tuple([absPath, z.string().min(1).max(100_000)]),
    (r, m) => git.commit(r, m),
    log,
  )
  registerHandler('git:branches', z.tuple([absPath]), (r) => git.branches(r), log)
  registerHandler(
    'git:checkout',
    z.tuple([absPath, branch, z.boolean()]),
    (r, b, c) => git.checkout(r, b, c),
    log,
  )
  registerHandler('git:worktreeList', z.tuple([absPath]), (r) => git.worktrees(r), log)
  registerHandler(
    'git:worktreeAdd',
    z.tuple([absPath, branch, z.boolean()]),
    (r, b, c) => git.addWorktree(r, b, c),
    log,
  )
  registerHandler(
    'git:worktreeRemove',
    z.tuple([absPath, absPath, z.boolean()]),
    (r, p, f) => git.removeWorktree(r, p, f),
    log,
  )
  registerHandler('git:watch', z.tuple([absPath]), (r) => watch.watch(r), log)
  registerHandler('git:unwatch', z.tuple([absPath]), (r) => watch.unwatch(r), log)
}
