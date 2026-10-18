import type { GitStatus } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, fail, installApi, ok } from '../../test/fake-api'
import { useGitStore } from './git.store'
import { refreshGit } from './git-sync.actions'

const repo = (branch: string): GitStatus => ({
  isRepo: true,
  branch,
  head: 'abc',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: [],
  worktreePath: '/r',
  isMainWorktree: true,
})

describe('refreshGit', () => {
  beforeEach(() => useGitStore.getState().reset('/r'))
  afterEach(() => vi.unstubAllGlobals())

  it('grava status, branches e worktrees do repositório aberto', async () => {
    installApi({
      git: {
        status: vi.fn(async () => ok(repo('main'))),
        branches: vi.fn(async () => ok([])),
        worktreeList: vi.fn(async () => ok([])),
      },
    })
    await refreshGit()
    expect(useGitStore.getState().status).toMatchObject({ branch: 'main' })
  })

  it('agrupa chamadas feitas durante uma busca numa única busca extra', async () => {
    const first = deferred<ReturnType<typeof ok<GitStatus>>>()
    const status = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(ok(repo('depois')))
    installApi({
      git: {
        status,
        branches: vi.fn(async () => ok([])),
        worktreeList: vi.fn(async () => ok([])),
      },
    })
    const running = refreshGit()
    void refreshGit()
    void refreshGit()
    first.resolve(ok(repo('antes')))
    await running
    expect(status).toHaveBeenCalledTimes(2)
    expect(useGitStore.getState().status).toMatchObject({ branch: 'depois' })
  })

  it('descarta a resposta se o repositório mudou no meio', async () => {
    const pending = deferred<ReturnType<typeof ok<GitStatus>>>()
    installApi({
      git: {
        status: vi.fn(() => pending.promise),
        branches: vi.fn(async () => ok([])),
        worktreeList: vi.fn(async () => ok([])),
      },
    })
    const running = refreshGit()
    useGitStore.getState().reset('/outro')
    pending.resolve(ok(repo('velho')))
    await running
    expect(useGitStore.getState().status).toBeNull()
  })

  it('falha no status marca a pasta como não-repositório', async () => {
    installApi({ git: { status: vi.fn(async () => fail('não é repo')) } })
    await refreshGit()
    expect(useGitStore.getState().status).toEqual({ isRepo: false })
  })
})
