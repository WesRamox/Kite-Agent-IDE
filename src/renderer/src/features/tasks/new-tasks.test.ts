import type { Task, WorkspaceTasks } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { pendingTaskWith, unannounced } from './new-tasks'

const task = (id: string, paths: string[], pending: boolean): Task => ({
  id,
  key: id,
  name: id,
  source: 'folder',
  why: '',
  folder: null,
  worktrees: paths.map((path) => ({ repo: '/r', repoName: 'r', path, branch: id, head: 'abc' })),
  hidden: false,
  pending,
  notes: '',
  summary: [],
  rule: [],
})
const ws = (tasks: Task[], imported = true): WorkspaceTasks => ({
  root: '/ws',
  repos: [],
  ignoredRepos: [],
  tasks,
  unassigned: [],
  grouping: { mode: 'auto', pattern: '' },
  imported,
  sessionLinks: {},
})

describe('unannounced', () => {
  it('só tarefas novas, e só depois da primeira importação', () => {
    const tasks = [task('TECH-1', ['/wt/a'], true), task('PAY-1', ['/wt/b'], false)]
    expect(unannounced(ws(tasks), new Set()).map((t) => t.id)).toEqual(['TECH-1'])
    expect(unannounced(ws(tasks, false), new Set())).toEqual([])
  })

  it('não repete o aviso quando a tarefa ganha outra worktree e muda de id', () => {
    const regrouped = task('folder:/ws/.worktrees/TECH-1', ['/wt/a', '/wt/c'], true)
    expect(unannounced(ws([regrouped]), new Set(['/wt/a']))).toEqual([])
  })
})

describe('pendingTaskWith', () => {
  it('acha a tarefa nova atual pela worktree, mesmo com id novo', () => {
    const current = ws([task('folder:x', ['/wt/a', '/wt/c'], true)])
    expect(pendingTaskWith(current, '/wt/a')?.id).toBe('folder:x')
    expect(pendingTaskWith(current, '/wt/z')).toBeNull()
    expect(pendingTaskWith(null, '/wt/a')).toBeNull()
  })
})
