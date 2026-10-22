import type { Task, TaskWorktree, WorkspaceTasks } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { groupLoose, patternMisses } from './loose-groups'

const wt = (repoName: string, branch: string | null, path = `/w/${repoName}/${branch}`) =>
  ({ repo: `/w/${repoName}`, repoName, path, branch, head: 'abc1234' }) satisfies TaskWorktree

const ws = (over: Partial<WorkspaceTasks>): WorkspaceTasks => ({
  root: '/w',
  repos: [],
  ignoredRepos: [],
  tasks: [],
  unassigned: [],
  grouping: { mode: 'pattern', pattern: '.worktrees/{tarefa}/{repo}' },
  scanDepth: 2,
  imported: true,
  sessionLinks: {},
  ...over,
})

describe('groupLoose', () => {
  it('sugere uma tarefa para a mesma branch em repositórios diferentes, ignorando o prefixo', () => {
    const { groups, single } = groupLoose([
      wt('web', 'feature/TECH-1147-x'),
      wt('api', 'feat/TECH-1147-x'),
      wt('db', 'TECH-1147-x'),
      wt('api', 'feature/TECH-1074-y'),
      wt('shared', null),
    ])
    expect(groups.map((g) => [g.key, g.worktrees.map((w) => w.repoName)])).toEqual([
      ['TECH-1147-x', ['api', 'db', 'web']],
    ])
    expect(single.map((w) => w.repoName)).toEqual(['api', 'shared'])
  })

  it('duas worktrees do mesmo repositório não formam grupo', () => {
    const { groups, single } = groupLoose([
      wt('api', 'feat/X-1', '/w/api/a'),
      wt('api', 'fix/X-1', '/w/api/b'),
    ])
    expect(groups).toEqual([])
    expect(single).toHaveLength(2)
  })

  it('ordena os grupos pela chave, com números em ordem natural', () => {
    const { groups } = groupLoose([
      wt('a', 'T-10'),
      wt('b', 'T-10'),
      wt('a', 'T-9'),
      wt('b', 'T-9'),
    ])
    expect(groups.map((g) => g.key)).toEqual(['T-9', 'T-10'])
  })
})

describe('patternMisses', () => {
  const task = { source: 'pattern' } as Task
  it('avisa quando o padrão não achou nada e há worktrees soltas', () => {
    expect(patternMisses(ws({ unassigned: [wt('a', 'X')] }))).toBe(true)
  })
  it('não avisa se o padrão achou alguma, se não há soltas ou se o modo é outro', () => {
    expect(patternMisses(ws({ unassigned: [wt('a', 'X')], tasks: [task] }))).toBe(false)
    expect(patternMisses(ws({}))).toBe(false)
    expect(
      patternMisses(ws({ unassigned: [wt('a', 'X')], grouping: { mode: 'auto', pattern: '' } })),
    ).toBe(false)
  })
})
