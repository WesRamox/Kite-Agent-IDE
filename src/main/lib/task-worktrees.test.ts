import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { addWorktree, commonBranch, newTaskWorktreeDir } from './task-worktrees'

describe('addWorktree', () => {
  it('reaproveita a branch existente', async () => {
    const run = vi.fn().mockResolvedValueOnce('abc123\n').mockResolvedValueOnce('')
    await addWorktree(run, '/r', 'feat/x', '/wt')
    expect(run).toHaveBeenLastCalledWith('/r', ['worktree', 'add', '/wt', 'feat/x'])
  })

  it('cria a branch a partir do HEAD quando ela não existe', async () => {
    const run = vi.fn().mockResolvedValueOnce('').mockResolvedValueOnce('')
    await addWorktree(run, '/r', 'feat/x', '/wt')
    expect(run).toHaveBeenLastCalledWith('/r', ['worktree', 'add', '-b', 'feat/x', '/wt', 'HEAD'])
  })

  it('prefixa o erro do git com o nome do repo', async () => {
    const run = vi.fn().mockResolvedValueOnce('').mockRejectedValueOnce(new Error('já existe'))
    await expect(addWorktree(run, '/r', 'b', '/wt', 'api')).rejects.toMatchObject({
      code: 'GIT_ERROR',
      message: 'api: já existe',
    })
  })
})

describe('newTaskWorktreeDir', () => {
  it('usa o padrão do workspace', () => {
    const dir = newTaskWorktreeDir({
      root: '/ws',
      single: false,
      pattern: '.worktrees/{tarefa}/{repo}',
      key: 'PAY-1',
      repoName: 'api',
    })
    expect(dir).toBe(path.resolve('/ws', '.worktrees/PAY-1/api'))
  })

  it('repo único aberto direto vai para a pasta irmã', () => {
    const dir = newTaskWorktreeDir({
      root: '/src/api',
      single: true,
      pattern: 'x',
      key: 'k',
      repoName: 'api',
    })
    expect(dir).toBe(path.join('/src', 'api-worktrees', 'k'))
  })
})

describe('commonBranch', () => {
  it('escolhe a branch mais frequente', () => {
    const worktrees = [
      { branch: 'feat/a' },
      { branch: 'feat/a' },
      { branch: 'outra' },
      { branch: null },
    ]
    expect(commonBranch(worktrees)).toBe('feat/a')
  })
})
