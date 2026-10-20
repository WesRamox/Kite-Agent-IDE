import type { AgentSession, Task } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { linkSessions, touchedByRepo } from './task-links'

const task = (id: string, folder: string | null, paths: string[]): Task => ({
  id,
  key: id,
  name: id,
  source: folder ? 'folder' : 'branch',
  why: '',
  folder,
  worktrees: paths.map((p) => ({
    repo: p,
    repoName: p.split('/').pop() ?? '',
    path: p,
    branch: id,
    head: '',
  })),
  hidden: false,
  pending: false,
  notes: '',
  summary: [],
  rule: [],
})

const session = (id: string, cwd: string, touched: string[] = []): AgentSession => ({
  id,
  cli: 'claude',
  cwd,
  status: 'running',
  waitReason: null,
  waitingSince: null,
  pending: null,
  activity: null,
  runningSince: 0,
  lastMessage: null,
  firstPrompt: null,
  touchedPaths: touched,
  touchedCount: touched.length,
  agentTaskId: null,
  ptyId: null,
  startedAt: 0,
  lastEventAt: 0,
  endedAt: null,
})

const pay = task('PAY', '/w/.worktrees/PAY', ['/w/.worktrees/PAY/api', '/w/.worktrees/PAY/web'])
const ops = task('OPS', null, ['/x/api-worktrees/OPS', '/x/infra-worktrees/OPS'])

describe('linkSessions', () => {
  it('liga pelo cwd, pelos arquivos editados ou pelo vínculo manual', () => {
    const links = linkSessions(
      [
        session('a', '/w/.worktrees/PAY'),
        session('b', '/x/infra-worktrees/OPS/src'),
        session('c', '/w', [
          '/x/api-worktrees/OPS/a.ts',
          '/x/api-worktrees/OPS/b.ts',
          '/w/.worktrees/PAY/api/c.ts',
        ]),
        session('d', '/w'),
        session('e', '/w/.worktrees/PAY/api'),
      ],
      [pay, ops],
      { e: 'OPS', d: 'nao-existe' },
    )
    expect(Object.fromEntries(links)).toEqual({ a: 'PAY', b: 'OPS', c: 'OPS', e: 'OPS' })
  })

  it('não confunde pastas com prefixo igual', () => {
    const links = linkSessions([session('a', '/w/.worktrees/PAY-2')], [pay], {})
    expect(links.size).toBe(0)
  })

  it('conta arquivos editados por repo', () => {
    expect(
      touchedByRepo(pay, [
        session('a', '/w', ['/w/.worktrees/PAY/api/a.ts', '/w/.worktrees/PAY/api/b.ts']),
      ]),
    ).toEqual({ api: 2, web: 0 })
  })
})
