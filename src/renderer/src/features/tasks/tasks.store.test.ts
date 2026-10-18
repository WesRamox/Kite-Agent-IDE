import type { GitStatus, Task, TaskWorktree } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { taskBaseDir, useTasksStore, worktreeOf } from './tasks.store'

const wt = (path: string): TaskWorktree => ({
  repo: `${path}-main`,
  repoName: path.split('/').pop() ?? '',
  path,
  branch: 'feat/x',
  head: 'abc',
})
const task = (folder: string | null, paths: string[]): Task => ({
  id: 't1',
  key: 'PAY-1',
  name: 'Pix',
  source: 'folder',
  why: '',
  folder,
  worktrees: paths.map(wt),
  hidden: false,
  notes: '',
})
const status = (root: string, files: string[]): GitStatus => ({
  isRepo: true,
  branch: 'feat/x',
  head: 'abc',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: files.map((f) => ({ path: `${root}/${f}`, staged: null, unstaged: 'modified' })),
  worktreePath: root,
  isMainWorktree: false,
})

describe('tasks.store', () => {
  beforeEach(() => useTasksStore.getState().reset())

  it('junta o status de todas as worktrees da tarefa', () => {
    const { setStatus } = useTasksStore.getState()
    setStatus('/w/api', status('/w/api', ['src/a.ts']))
    setStatus('/w/web', status('/w/web', ['b.ts']))
    const { byPath, changedDirs } = useTasksStore.getState()
    expect([...byPath.keys()].sort()).toEqual(['/w/api/src/a.ts', '/w/web/b.ts'])
    expect(changedDirs.has('/w/api/src')).toBe(true)
  })

  it('status novo de uma worktree substitui o anterior dela', () => {
    const { setStatus } = useTasksStore.getState()
    setStatus('/w/api', status('/w/api', ['a.ts']))
    setStatus('/w/api', status('/w/api', []))
    expect(useTasksStore.getState().byPath.size).toBe(0)
  })

  it('pasta base dos terminais: a da tarefa, senão a primeira worktree', () => {
    expect(taskBaseDir(task('/w/.worktrees/PAY-1', ['/w/api']))).toBe('/w/.worktrees/PAY-1')
    expect(taskBaseDir(task(null, ['/w/api', '/w/web']))).toBe('/w/api')
    expect(taskBaseDir(null)).toBeNull()
  })

  it('worktreeOf não confunde pastas com prefixo parecido', () => {
    const t = task(null, ['/w/api', '/w/api2'])
    expect(worktreeOf(t, '/w/api2/x.ts')?.path).toBe('/w/api2')
    expect(worktreeOf(t, '/w/api/x.ts')?.path).toBe('/w/api')
    expect(worktreeOf(t, '/w/outro/x.ts')).toBeNull()
  })
})
