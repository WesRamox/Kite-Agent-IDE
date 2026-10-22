import path from 'node:path'
import type { AgentSession } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { SessionReviewService, type ReviewState } from './session-review.service'

// Caminho absoluto no formato do SO (no Windows ganha a letra do disco).
const abs = (p: string): string => path.resolve(p)

const session: AgentSession = {
  id: 's1',
  cli: 'claude',
  cwd: abs('/nao-existe/loja'),
  status: 'ended',
  waitReason: null,
  waitingSince: null,
  pending: null,
  activity: null,
  runningSince: null,
  lastMessage: null,
  firstPrompt: 'Tem algum arquivo faltando commit?',
  touchedPaths: [
    abs('/nao-existe/loja/src/a.ts'),
    abs('/nao-existe/lib/b.ts'),
    abs('/nao-existe/loja/c.ts'),
  ],
  touchedCount: 3,
  createdWorktrees: [],
  agentTaskId: null,
  ptyId: null,
  startedAt: 0,
  lastEventAt: 10,
  endedAt: 10,
}

function setup() {
  let state: ReviewState = { dismissed: {} }
  let now = 1_000
  const git = {
    // c.ts já foi commitado: não aparece.
    pendingFiles: vi.fn(async () => [
      { toplevel: abs('/nao-existe/lib'), rel: 'b.ts', status: 'untracked' as const },
      { toplevel: abs('/nao-existe/loja'), rel: 'src/a.ts', status: 'modified' as const },
    ]),
    diffSince: vi.fn(async () => ({ original: 'a', modified: 'b', binary: false })),
  }
  const svc = new SessionReviewService({
    session: (id) => (id === 's1' ? session : undefined),
    review: git,
    store: {
      read: async () => state,
      write: async (v) => {
        state = v
      },
    },
    now: () => now,
    keepMs: 100,
  })
  return { svc, git, advance: (ms: number) => (now += ms) }
}

describe('SessionReviewService', () => {
  it('lista o que a sessão editou e ainda não foi commitado, relativo à pasta dela', async () => {
    const { svc, git } = setup()
    await expect(svc.review('s1')).resolves.toEqual({
      base: 'HEAD',
      mergeBase: 'HEAD',
      files: [
        { path: abs('/nao-existe/lib/b.ts'), status: 'untracked' },
        { path: 'src/a.ts', status: 'modified' },
      ],
    })
    expect(git.pendingFiles).toHaveBeenCalledWith(session.touchedPaths)
    await expect(svc.review('outra')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('diff só de arquivos pendentes que a sessão editou', async () => {
    const { svc, git } = setup()
    await expect(svc.diff('s1', 'src/a.ts')).resolves.toMatchObject({ modified: 'b' })
    expect(git.diffSince).toHaveBeenCalledWith(abs('/nao-existe/loja'), 'HEAD', 'src/a.ts')
    await svc.diff('s1', abs('/nao-existe/lib/b.ts'))
    expect(git.diffSince).toHaveBeenLastCalledWith(abs('/nao-existe/lib'), 'HEAD', 'b.ts')
    for (const p of ['c.ts', '../../etc/passwd', '/etc/passwd']) {
      await expect(svc.diff('s1', p)).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
    }
  })

  it('conta os pendentes por sessão, ignorando sessões desconhecidas', async () => {
    const { svc } = setup()
    await expect(svc.pendingCounts(['s1', 'sumiu'])).resolves.toEqual({ s1: 2 })
  })

  it('guarda os itens dispensados e esquece os antigos', async () => {
    const { svc, advance } = setup()
    await expect(svc.dismiss('session:s1')).resolves.toEqual(['session:s1'])
    advance(60)
    await svc.dismiss('task:t1:5')
    await expect(svc.dismissed()).resolves.toEqual(['session:s1', 'task:t1:5'])
    advance(60)
    await expect(svc.dismissed()).resolves.toEqual(['task:t1:5'])
  })
})
