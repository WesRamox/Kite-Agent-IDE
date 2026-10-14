import { describe, expect, it } from 'vitest'
import { parseBranches, parseStatusV2, parseWorktrees, worktreeDirName } from './git-parse'

describe('parseStatusV2', () => {
  it('lê cabeçalhos de branch e contagens', () => {
    const out = [
      '# branch.oid 1234567890abcdef',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '',
    ].join('\0')
    expect(parseStatusV2(out)).toMatchObject({
      head: '1234567',
      branch: 'main',
      upstream: 'origin/main',
      ahead: 2,
      behind: 1,
      files: [],
    })
  })

  it('reconhece repositório sem commits e HEAD destacado', () => {
    expect(parseStatusV2('# branch.oid (initial)\0# branch.head (detached)\0')).toMatchObject({
      head: null,
      branch: null,
    })
  })

  it('interpreta entradas comuns, renomeadas, não rastreadas e conflitos', () => {
    const out = [
      '1 .M N... 100644 100644 100644 aaa bbb src/a b.ts',
      '1 A. N... 000000 100644 100644 000 ccc novo.ts',
      '1 MD N... 100644 100644 000000 aaa bbb x.ts',
      '2 R. N... 100644 100644 100644 aaa aaa R100 depois.ts',
      'antes.ts',
      '? solto.txt',
      'u UU N... 100644 100644 100644 100644 a b c conflito.ts',
      '',
    ].join('\0')
    expect(parseStatusV2(out).files).toEqual([
      { rel: 'src/a b.ts', staged: null, unstaged: 'modified' },
      { rel: 'novo.ts', staged: 'added', unstaged: null },
      { rel: 'x.ts', staged: 'modified', unstaged: 'deleted' },
      { rel: 'depois.ts', origRel: 'antes.ts', staged: 'renamed', unstaged: null },
      { rel: 'solto.txt', staged: null, unstaged: 'untracked' },
      { rel: 'conflito.ts', staged: null, unstaged: 'conflicted' },
    ])
  })
})

describe('parseBranches', () => {
  it('lê branch atual, upstream e worktree', () => {
    const out = 'main\0*\0origin/main\0/repo\nfeat/x\0 \0\0/repo-worktrees/feat-x\nvelha\0 \0\0\n'
    expect(parseBranches(out)).toEqual([
      { name: 'main', current: true, upstream: 'origin/main', worktreePath: '/repo' },
      { name: 'feat/x', current: false, upstream: null, worktreePath: '/repo-worktrees/feat-x' },
      { name: 'velha', current: false, upstream: null, worktreePath: null },
    ])
  })
})

describe('parseWorktrees', () => {
  it('lê a lista porcelain', () => {
    const out = [
      'worktree /repo',
      'HEAD 1111111111',
      'branch refs/heads/main',
      '',
      'worktree /repo-worktrees/feat-x',
      'HEAD 2222222222',
      'branch refs/heads/feat/x',
      'locked',
      '',
      'worktree /tmp/solto',
      'HEAD 3333333333',
      'detached',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n')
    expect(parseWorktrees(out, '/repo-worktrees/feat-x')).toEqual([
      {
        path: '/repo',
        branch: 'main',
        head: '1111111',
        isMain: true,
        isCurrent: false,
        locked: false,
        prunable: false,
      },
      {
        path: '/repo-worktrees/feat-x',
        branch: 'feat/x',
        head: '2222222',
        isMain: false,
        isCurrent: true,
        locked: true,
        prunable: false,
      },
      {
        path: '/tmp/solto',
        branch: null,
        head: '3333333',
        isMain: false,
        isCurrent: false,
        locked: false,
        prunable: true,
      },
    ])
  })
})

describe('worktreeDirName', () => {
  it('achata barras e remove pontos iniciais', () => {
    expect(worktreeDirName('feat/login')).toBe('feat-login')
    expect(worktreeDirName('..x')).toBe('x')
  })
})
