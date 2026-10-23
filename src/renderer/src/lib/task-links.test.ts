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
    repoName: p.split(/[\\/]/).pop() ?? '',
    path: p,
    branch: id,
    head: '',
  })),
  hidden: false,
  pending: false,
  done: false,
  notes: '',
  summary: [],
  rule: [],
})

const session = (
  id: string,
  cwd: string,
  touched: string[] = [],
  created: string[] = [],
): AgentSession => ({
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
  createdWorktrees: created,
  agentTaskId: null,
  ptyId: null,
  startedAt: 0,
  lastEventAt: 0,
  endedAt: null,
})

const pay = task('PAY', '/w/.worktrees/PAY', ['/w/.worktrees/PAY/api', '/w/.worktrees/PAY/web'])
const ops = task('OPS', null, ['/x/api-worktrees/OPS', '/x/infra-worktrees/OPS'])

describe('linkSessions', () => {
  it('no Windows, liga por subpasta da worktree e por arquivo editado dentro dela', () => {
    const win = task('TECH-1', 'C:\\ws\\.worktrees\\TECH-1', [
      'C:\\ws\\.worktrees\\TECH-1\\api',
      'C:\\ws\\.worktrees\\TECH-1\\web',
    ])
    const links = linkSessions(
      [
        session('cwd', 'C:\\ws\\.worktrees\\TECH-1\\api\\src'),
        // Caixa da letra do disco e barras do Git Bash não importam.
        session('caixa', 'c:/ws/.worktrees/TECH-1/web'),
        session('arquivos', 'C:\\ws', ['C:\\ws\\.worktrees\\TECH-1\\web\\page.tsx']),
        // Pasta irmã com o mesmo prefixo não é a tarefa.
        session('irmao', 'C:\\ws\\.worktrees\\TECH-10'),
      ],
      [win],
      {},
    )
    expect(Object.fromEntries(links)).toEqual({
      cwd: 'TECH-1',
      caixa: 'TECH-1',
      arquivos: 'TECH-1',
    })
    expect(
      touchedByRepo(win, [session('s', 'C:\\ws', ['C:\\ws\\.worktrees\\TECH-1\\api\\a.ts'])]),
    ).toEqual({ api: 1, web: 0 })
  })

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

describe('sessão que criou as worktrees', () => {
  const tasks = [
    task('PAY-1', null, ['/ws/.worktrees/PAY-1/api']),
    task('PAY-77', '/ws/.worktrees/PAY-77', [
      '/ws/.worktrees/PAY-77/web',
      '/ws/.worktrees/PAY-77/api',
    ]),
  ]

  it('fica ligada à tarefa da última worktree que criou, acima dos arquivos editados', () => {
    const s = session(
      's1',
      '/ws',
      ['/ws/.worktrees/PAY-1/api/a.ts', '/ws/.worktrees/PAY-1/api/b.ts'],
      ['/ws/.worktrees/PAY-77/api', '/ws/.worktrees/PAY-1/api'],
    )
    expect(linkSessions([s], tasks, {}).get('s1')).toBe('PAY-77')
  })

  it('compara caminhos do Windows sem ligar para barra e caixa', () => {
    const win = [task('T', null, ['C:\\Users\\ana\\projetos\\.worktrees\\T\\fe'])]
    const s = session(
      's1',
      'C:\\Users\\ana\\projetos',
      [],
      ['c:/Users/ana/projetos/.worktrees/T/fe/'],
    )
    expect(linkSessions([s], win, {}).get('s1')).toBe('T')
  })

  it('vínculo manual ainda vence', () => {
    const s = session('s1', '/ws', [], ['/ws/.worktrees/PAY-77/web'])
    expect(linkSessions([s], tasks, { s1: 'PAY-1' }).get('s1')).toBe('PAY-1')
  })
})
