import { describe, expect, it } from 'vitest'
import {
  branchKey,
  EMPTY_OVERRIDES,
  groupWorktrees,
  parseTaskMeta,
  patternBase,
  patternRegex,
  type RepoWorktrees,
} from './task-grouping'

const ROOT = '/p/loja'
const AUTO = { mode: 'auto' as const, pattern: '' }

// Os três layouts do critério de aceite, e uma worktree solta sem branch.
const repos: RepoWorktrees[] = [
  {
    repo: '/p/loja/api',
    name: 'api',
    worktrees: [
      { path: '/p/loja/.worktrees/PAY-412/api', branch: 'PAY-412', head: 'a1' },
      { path: '/p/api-worktrees/OPS-19', branch: 'feat/OPS-19', head: 'a2' },
      { path: '/p/api-worktrees/OUTRA', branch: 'fix/outra', head: 'a3' },
    ],
  },
  {
    repo: '/p/loja/web',
    name: 'web',
    worktrees: [
      { path: '/p/loja/.worktrees/PAY-412/web', branch: 'PAY-412', head: 'b1' },
      { path: '/p/loja/web-hotfix', branch: null, head: 'b2' },
    ],
  },
  {
    repo: '/p/loja/infra',
    name: 'infra',
    worktrees: [{ path: '/p/infra-worktrees/OPS-19', branch: 'feat/OPS-19', head: 'c1' }],
  },
]

describe('groupWorktrees', () => {
  it('agrupa por pasta da tarefa e por branch; deixa soltas as sem branch', () => {
    const { tasks, unassigned } = groupWorktrees(ROOT, repos, AUTO, EMPTY_OVERRIDES)
    expect(tasks.map((t) => [t.key, t.source, t.worktrees.map((w) => w.repoName)])).toEqual([
      ['OPS-19', 'branch', ['api', 'infra']],
      ['outra', 'branch', ['api']],
      ['PAY-412', 'folder', ['api', 'web']],
    ])
    const pay = tasks.find((t) => t.key === 'PAY-412')
    expect(pay).toMatchObject({
      folder: '/p/loja/.worktrees/PAY-412',
      why: 'mesma pasta .worktrees/PAY-412',
    })
    expect(tasks.find((t) => t.key === 'OPS-19')?.why).toBe('mesma branch em 2 repos')
    expect(unassigned.map((w) => w.path)).toEqual(['/p/loja/web-hotfix'])
  })

  it('pasta de worktrees de um repo só não vira tarefa', () => {
    const { tasks } = groupWorktrees(ROOT, repos, AUTO, EMPTY_OVERRIDES)
    expect(tasks.some((t) => t.folder === '/p/api-worktrees')).toBe(false)
  })

  it('uma worktree com o nome do repo dentro da pasta da tarefa já é uma tarefa', () => {
    const { tasks } = groupWorktrees(
      ROOT,
      [
        {
          repo: '/p/loja/mobile',
          name: 'mobile',
          worktrees: [{ path: '/p/loja/.worktrees/MOB-52/mobile', branch: 'x', head: 'h' }],
        },
      ],
      AUTO,
      EMPTY_OVERRIDES,
    )
    expect(tasks).toMatchObject([{ key: 'MOB-52', source: 'folder' }])
  })

  it('modo padrão: só o que casa com o padrão vira tarefa', () => {
    const { tasks, unassigned } = groupWorktrees(
      ROOT,
      repos,
      { mode: 'pattern', pattern: '.worktrees/{tarefa}/{repo}' },
      EMPTY_OVERRIDES,
    )
    expect(tasks.map((t) => [t.key, t.worktrees.length])).toEqual([['PAY-412', 2]])
    expect(unassigned).toHaveLength(4)
  })

  it('modo manual: nada agrupado, a não ser o que o usuário montou', () => {
    const { tasks, unassigned } = groupWorktrees(
      ROOT,
      repos,
      { mode: 'manual', pattern: '' },
      {
        ...EMPTY_OVERRIDES,
        manual: [{ id: 'manual:1', name: 'Hotfix header' }],
        moves: { '/p/loja/web-hotfix': 'manual:1' },
      },
    )
    expect(tasks).toMatchObject([
      { id: 'manual:1', key: 'Hotfix header', worktrees: [{ repoName: 'web' }] },
    ])
    expect(unassigned).toHaveLength(5)
  })

  it('ajustes: mover para outra tarefa e ignorar', () => {
    const { tasks, unassigned } = groupWorktrees(ROOT, repos, AUTO, {
      ...EMPTY_OVERRIDES,
      moves: { '/p/loja/web-hotfix': 'folder:/p/loja/.worktrees/PAY-412' },
      ignored: ['/p/api-worktrees/OUTRA'],
    })
    expect(tasks.find((t) => t.key === 'PAY-412')?.worktrees.map((w) => w.path)).toContain(
      '/p/loja/web-hotfix',
    )
    expect(tasks.some((t) => t.key === 'outra')).toBe(false)
    expect(unassigned).toEqual([])
  })

  it('branchKey e padrões', () => {
    expect(branchKey('feat/OPS-19')).toBe('OPS-19')
    expect(branchKey('agent/corrigir-login')).toBe('corrigir-login')
    expect(branchKey('main')).toBe('main')
    expect(patternRegex('.worktrees/{tarefa}/{repo}')?.exec('.worktrees/A-1/api')?.[1]).toBe('A-1')
    expect(patternRegex('wt/{task}/{repo}')?.exec('wt/A-2/web')?.[1]).toBe('A-2')
    expect(patternRegex('sem-marcador')).toBeNull()
  })

  it('pasta fixa do padrão e níveis depois dela', () => {
    expect(patternBase('.worktrees/{tarefa}/{repo}')).toEqual({ dir: '.worktrees', levels: 2 })
    expect(patternBase('./wt/tarefas/{task}-{repo}')).toEqual({ dir: 'wt/tarefas', levels: 1 })
    expect(patternBase('wt\\{tarefa}\\{repo}')).toEqual({ dir: 'wt', levels: 2 })
    expect(patternBase('{tarefa}/{repo}')).toBeNull()
  })

  it('lê o título da tarefa', () => {
    expect(parseTaskMeta('json', '{"title":"Checkout com Pix","url":"https://x"}')).toEqual({
      title: 'Checkout com Pix',
      summary: [],
      rule: [],
    })
    expect(parseTaskMeta('json', 'quebrado')).toEqual({ title: null, summary: [], rule: [] })
    expect(parseTaskMeta('md', '# PAY-412 Checkout\n')).toEqual({
      title: 'PAY-412 Checkout',
      summary: [],
      rule: [],
    })
  })

  it('o resumo é o texto logo abaixo do título, em texto puro, até o próximo título', () => {
    const md = [
      'antes do título não conta',
      '# Checkout com Pix',
      'Aceitar **Pix** no `checkout`.',
      '',
      '- gerar o QR',
      '  * confirmar pelo webhook',
      '```ts',
      '## Detalhes',
      'fica de fora',
    ].join('\r\n')
    expect(parseTaskMeta('md', md).summary).toEqual([
      'Aceitar Pix no checkout.',
      '• gerar o QR',
      '• confirmar pelo webhook',
    ])
  })

  it('lê a regra de negócio da seção "## Regra de negócio", sem misturar com o resumo', () => {
    const md = [
      '# Checkout com Pix',
      'Aceitar Pix no checkout.',
      '## Regra de negócio',
      '✅ Pedido pago por Pix só vira **emitido** depois do webhook.',
      '## Notas',
      'fica de fora',
    ].join('\n')
    const meta = parseTaskMeta('md', md)
    expect(meta.summary).toEqual(['Aceitar Pix no checkout.'])
    expect(meta.rule).toEqual(['✅ Pedido pago por Pix só vira emitido depois do webhook.'])
    expect(parseTaskMeta('md', '# T\n## Regras de negocio\n⚠️ dúvida').rule).toEqual(['⚠️ dúvida'])
  })

  it('limita o resumo para um TASK.md enorme não tomar o painel', () => {
    const md = `# T\n${'x'.repeat(900)}\n${'linha\n'.repeat(30)}`
    const summary = parseTaskMeta('md', md).summary
    expect(summary).toHaveLength(20)
    expect(summary[0]).toHaveLength(500)
  })
})
