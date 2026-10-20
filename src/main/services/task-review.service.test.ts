import type { GitStatus, PullSummary, Task } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '../lib/logger'
import { TaskReviewService, type TaskReviewServiceDeps } from './task-review.service'

const task: Task = {
  id: 'folder:/w/PAY',
  key: 'PAY',
  name: 'Pix',
  source: 'folder',
  why: '',
  folder: '/w/PAY',
  worktrees: [
    { repo: '/w/api', repoName: 'api', path: '/w/PAY/api', branch: 'PAY', head: 'a' },
    { repo: '/w/web', repoName: 'web', path: '/w/PAY/web', branch: 'PAY', head: 'b' },
  ],
  hidden: false,
  notes: '',
  summary: [],
  rule: [],
}

const status = (files: number, branch: string | null = 'PAY'): GitStatus => ({
  isRepo: true,
  branch,
  head: 'x',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: Array.from({ length: files }, (_, i) => ({
    path: `/f${i}`,
    staged: null,
    unstaged: 'modified' as const,
  })),
  worktreePath: '/w',
  isMainWorktree: false,
})

function setup(
  opts: { dirty?: Record<string, number>; existing?: Record<string, PullSummary> } = {},
) {
  let n = 100
  const git = {
    status: vi.fn(async (p: string) => status(opts.dirty?.[p] ?? 0)),
    changesSince: vi.fn(async () => ({
      mergeBase: 'mb',
      files: [
        { path: 'src/a.ts', status: 'modified' as const },
        { path: 'novo.ts', status: 'untracked' as const },
      ],
    })),
    numstatSince: vi.fn(
      async () =>
        new Map([
          ['src/a.ts', { added: 5, deleted: 2 }],
          ['novo.ts', { added: 10, deleted: 0 }],
        ]),
    ),
    commitsSince: vi.fn(async () => 2),
    defaultBase: vi.fn(async () => 'main'),
    diffSince: vi.fn(async () => ({ original: 'a', modified: 'b', binary: false })),
    commitAll: vi.fn(async () => ({ hash: 'h' })),
  }
  const github = {
    prForBranch: vi.fn(async (p: string) => opts.existing?.[p] ?? null),
    createPR: vi.fn(async (p: string) => {
      n += 1
      return { number: n, url: `https://gh/${p.split('/').pop()}/pull/${n}` }
    }),
    updatePRBody: vi.fn(async () => {}),
    pushCurrent: vi.fn(async () => {}),
  }
  const deps = {
    tasks: { open: vi.fn(async () => task) },
    git,
    review: git,
    github,
    log: createLogger('test', 'error', () => {}),
  } as unknown as TaskReviewServiceDeps
  return { svc: new TaskReviewService(deps), git, github }
}

const input = {
  worktrees: ['/w/PAY/api', '/w/PAY/web'],
  message: 'feat: pix',
  openPRs: true,
  title: 'Pix',
  body: 'Corpo',
  draft: false,
  bases: {},
}

describe('TaskReviewService', () => {
  it('revisão por repo: arquivos com +/-, totais, commits à frente e base detectada', async () => {
    const { svc } = setup({ dirty: { '/w/PAY/api': 2 } })
    const review = await svc.review('/w', task.id)
    expect(review.repos[0]).toMatchObject({
      repoName: 'api',
      base: 'main',
      added: 15,
      deleted: 2,
      uncommitted: 2,
      ahead: 2,
      files: [
        { rel: 'src/a.ts', status: 'modified', added: 5, deleted: 2 },
        { rel: 'novo.ts', status: 'untracked', added: 10, deleted: 0 },
      ],
    })
  })

  it('alterados por worktree: só a lista, sem +/- nem PR; erro fica no repo', async () => {
    const { svc, git, github } = setup()
    git.changesSince.mockRejectedValueOnce(new Error('sem base'))
    const changes = await svc.changes('/w', task.id)
    expect(changes).toEqual([
      { worktree: '/w/PAY/api', base: 'main', files: [], error: 'sem base' },
      {
        worktree: '/w/PAY/web',
        base: 'main',
        files: [
          { rel: 'src/a.ts', status: 'modified' },
          { rel: 'novo.ts', status: 'untracked' },
        ],
        error: null,
      },
    ])
    expect(git.numstatSince).not.toHaveBeenCalled()
    expect(github.prForBranch).not.toHaveBeenCalled()
  })

  it('entrega: commita só quem tem alterações, abre os PRs e cruza os links', async () => {
    const { svc, git, github } = setup({ dirty: { '/w/PAY/api': 1 } })
    const results = await svc.deliver('/w', task.id, input)
    expect(git.commitAll).toHaveBeenCalledTimes(1)
    expect(git.commitAll).toHaveBeenCalledWith('/w/PAY/api', 'feat: pix')
    expect(results.map((r) => [r.repoName, r.committed, r.pr?.number, r.error])).toEqual([
      ['api', true, 101, null],
      ['web', false, 102, null],
    ])
    expect(github.updatePRBody).toHaveBeenCalledWith(
      '/w/PAY/api',
      101,
      'Corpo\n\n---\n**PRs desta tarefa:**\n- web: https://gh/web/pull/102',
    )
    expect(github.updatePRBody).toHaveBeenCalledWith(
      '/w/PAY/web',
      102,
      'Corpo\n\n---\n**PRs desta tarefa:**\n- api: https://gh/api/pull/101',
    )
  })

  it('PR já aberto: só envia a branch e não reescreve a descrição dele', async () => {
    const open = { number: 7, url: 'https://gh/api/pull/7', state: 'open' } as PullSummary
    const { svc, github } = setup({ existing: { '/w/PAY/api': open } })
    const results = await svc.deliver('/w', task.id, input)
    expect(github.pushCurrent).toHaveBeenCalledWith('/w/PAY/api')
    expect(results[0]?.pr).toEqual({ number: 7, url: 'https://gh/api/pull/7', created: false })
    expect(github.updatePRBody).toHaveBeenCalledTimes(1)
    expect(github.updatePRBody).toHaveBeenCalledWith(
      '/w/PAY/web',
      101,
      expect.stringContaining('pull/7'),
    )
  })

  it('erro num repo não impede o outro; sem mensagem não commita', async () => {
    const { svc } = setup({ dirty: { '/w/PAY/api': 1 } })
    const results = await svc.deliver('/w', task.id, { ...input, message: ' ', openPRs: false })
    expect(results[0]?.error).toBe('Escreva a mensagem do commit')
    expect(results[1]).toMatchObject({ committed: false, error: null })
  })

  it('recusa base com cara de opção do git', async () => {
    const { svc } = setup()
    await expect(
      svc.diff('/w', task.id, '/w/PAY/api', '--output=/tmp/x', 'a'),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGS',
    })
    await expect(svc.diff('/w', task.id, '/outra', 'main', 'a')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
