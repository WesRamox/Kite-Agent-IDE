import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { worktreeAddTargets } from './worktree-command'

describe('worktreeAddTargets', () => {
  const p = path.posix

  it('acha a pasta do worktree add, relativa ao cwd e ao -C', () => {
    expect(
      worktreeAddTargets(
        'git -C SGE/fe worktree add -b TECH-1 ../../.worktrees/TECH-1/fe dev',
        '/ws',
        p,
      ),
    ).toEqual(['/ws/.worktrees/TECH-1/fe'])
    expect(worktreeAddTargets('git worktree add --force -B x "/ws/a b/fe"', '/ws', p)).toEqual([
      '/ws/a b/fe',
    ])
  })

  it('acompanha cd e vários comandos encadeados', () => {
    const cmd =
      'cd SGE/be && git fetch origin dev && git worktree add ../../.worktrees/T/be -b T origin/dev; cd ../fe && git worktree add ../../.worktrees/T/fe -b T'
    expect(worktreeAddTargets(cmd, '/ws', p)).toEqual([
      '/ws/.worktrees/T/be',
      '/ws/.worktrees/T/fe',
    ])
  })

  it('ignora o que não é worktree add', () => {
    expect(worktreeAddTargets('git worktree list --porcelain', '/ws', p)).toEqual([])
    expect(worktreeAddTargets('echo "git worktree add x"', '/ws', p)).toEqual([])
    expect(worktreeAddTargets('ls', '/ws', p)).toEqual([])
  })

  it('caminhos do Windows: barra invertida, aspas e o formato /c/ do Git Bash', () => {
    const w = path.win32
    expect(
      worktreeAddTargets(
        'git -C "C:\\Users\\israe\\speed\\SGE\\fe" worktree add ..\\..\\.worktrees\\T\\fe',
        'C:\\x',
        w,
      ),
    ).toEqual([w.resolve('C:\\Users\\israe\\speed\\.worktrees\\T\\fe')])
    expect(worktreeAddTargets('git worktree add /c/Users/israe/wt', 'C:\\x', w)).toEqual([
      'C:\\Users\\israe\\wt',
    ])
  })
})
