// @vitest-environment happy-dom
import type { GitStatus } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, installApi, ok } from '../../test/fake-api'
import { useToastStore } from '../../stores/toast.store'
import { useGitStore } from './git.store'

// O refresh depois de cada ação tem teste próprio; aqui só importa que ele aconteça.
const refreshGit = vi.fn(async () => {})
vi.mock('./git-sync.actions', () => ({ refreshGit: () => refreshGit() }))
const { commit, createWorktree, removeWorktree, stageAll } = await import('./git.actions')

const status: GitStatus = {
  isRepo: true,
  branch: 'main',
  head: 'abc',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: [
    { path: '/r/a.ts', staged: null, unstaged: 'modified' },
    { path: '/r/b.ts', staged: 'added', unstaged: null },
    { path: '/r/c.ts', staged: 'modified', unstaged: 'modified' },
  ],
  worktreePath: '/r',
  isMainWorktree: true,
}
const toasts = () => useToastStore.getState().toasts.map((t) => t.message)

describe('git: ações do painel', () => {
  beforeEach(() => {
    useGitStore.getState().reset('/r')
    useGitStore.getState().set({ status, branches: [] })
    useToastStore.setState({ toasts: [] })
    refreshGit.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('"stage tudo" manda só os arquivos com alterações fora do stage', async () => {
    const stage = vi.fn(async () => ok(undefined))
    installApi({ git: { stage } })
    await stageAll()
    expect(stage).toHaveBeenCalledWith('/r', ['/r/a.ts', '/r/c.ts'])
    expect(refreshGit).toHaveBeenCalled()
  })

  it('commit avisa o hash; falha vira toast de erro e devolve false', async () => {
    installApi({ git: { commit: vi.fn(async () => ok({ hash: 'f00ba4' })) } })
    expect(await commit('feat: x')).toBe(true)
    expect(toasts().some((m) => m.includes('f00ba4'))).toBe(true)
    installApi({ git: { commit: vi.fn(async () => fail('nada no stage', 'GIT_ERROR')) } })
    expect(await commit('feat: y')).toBe(false)
  })

  it('worktree de branch já usada em outra worktree: recusa sem chamar o git', async () => {
    useGitStore.getState().set({
      branches: [{ name: 'feat/x', current: false, upstream: null, worktreePath: '/r-wt/x' }],
    })
    const worktreeAdd = vi.fn()
    installApi({ git: { worktreeAdd } })
    expect(await createWorktree('feat/x')).toBeNull()
    expect(worktreeAdd).not.toHaveBeenCalled()
  })

  it('worktree reaproveita branch livre e cria branch nova quando não existe', async () => {
    useGitStore.getState().set({
      branches: [{ name: 'livre', current: false, upstream: null, worktreePath: null }],
    })
    const worktreeAdd = vi.fn(async () => ok({ path: '/wt' }))
    installApi({ git: { worktreeAdd } })
    await createWorktree('livre')
    await createWorktree('nova')
    expect(worktreeAdd).toHaveBeenNthCalledWith(1, '/r', 'livre', false)
    expect(worktreeAdd).toHaveBeenNthCalledWith(2, '/r', 'nova', true)
  })

  it('remover worktree com alterações pergunta de novo antes de forçar', async () => {
    const confirm = vi.fn(async () => ok(0))
    const worktreeRemove = vi
      .fn()
      .mockResolvedValueOnce(fail('contains modified files', 'GIT_ERROR'))
      .mockResolvedValueOnce(ok(undefined))
    installApi({ dialog: { confirm }, git: { worktreeRemove } })
    await removeWorktree('/r-wt/x')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(worktreeRemove).toHaveBeenLastCalledWith('/r', '/r-wt/x', true)
  })

  it('cancelar a segunda pergunta não força a remoção', async () => {
    const confirm = vi.fn().mockResolvedValueOnce(ok(0)).mockResolvedValueOnce(ok(1))
    const worktreeRemove = vi.fn(async () => fail('contains modified files', 'GIT_ERROR'))
    installApi({ dialog: { confirm }, git: { worktreeRemove } })
    await removeWorktree('/r-wt/x')
    expect(worktreeRemove).toHaveBeenCalledTimes(1)
  })
})
