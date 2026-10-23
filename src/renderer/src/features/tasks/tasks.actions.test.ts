// @vitest-environment happy-dom
import type { WorkspaceTasks } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, installApi, ok } from '../../test/fake-api'
import { useToastStore } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useTasksStore } from './tasks.store'

// Dock falso: o que importa é se a tela de descoberta foi aberta.
const addPanel = vi.fn()
vi.mock('../../lib/dock', async (orig) => ({
  ...(await orig<object>()),
  getDockApi: () => ({ getPanel: () => undefined, addPanel }),
}))
const { loadTasks } = await import('./tasks.actions')

const workspace = (patch: Partial<WorkspaceTasks>): WorkspaceTasks => ({
  root: '/ws',
  repos: [],
  ignoredRepos: [],
  tasks: [],
  unassigned: [{ repo: '/ws/api', repoName: 'api', path: '/ws/wt', branch: 'x', head: 'a' }],
  grouping: { mode: 'auto', pattern: '.worktrees/{tarefa}/{repo}' },
  scanDepth: 2,
  imported: false,
  sessionLinks: {},
  ...patch,
})

describe('loadTasks', () => {
  beforeEach(() => {
    addPanel.mockClear()
    useTasksStore.getState().reset()
    useWorkspaceStore.setState({ root: '/ws' })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ao abrir um workspace com worktrees pela primeira vez, abre a descoberta', async () => {
    installApi({
      task: {
        discover: vi.fn(async () => ok(workspace({}))),
        watch: vi.fn(async () => ok(undefined)),
      },
    })
    await loadTasks('/ws', { fromOpen: true })
    expect(useTasksStore.getState().workspace?.root).toBe('/ws')
    expect(addPanel).toHaveBeenCalledTimes(1)
  })

  it('descoberta já concluída não abre de novo', async () => {
    installApi({
      task: {
        discover: vi.fn(async () => ok(workspace({ imported: true }))),
        watch: vi.fn(async () => ok(undefined)),
      },
    })
    await loadTasks('/ws', { fromOpen: true })
    expect(addPanel).not.toHaveBeenCalled()
  })

  it('descarta a resposta se outra pasta foi aberta no meio', async () => {
    const pending = deferred<ReturnType<typeof ok<WorkspaceTasks>>>()
    const watch = vi.fn()
    installApi({ task: { discover: vi.fn(() => pending.promise), watch } })
    const loading = loadTasks('/ws', { fromOpen: true })
    useWorkspaceStore.setState({ root: '/outra' })
    pending.resolve(ok(workspace({})))
    await loading
    expect(useTasksStore.getState().workspace).toBeNull()
    expect(watch).not.toHaveBeenCalled()
  })
})

describe('aviso de tarefa nova', () => {
  const tech = {
    id: 'folder:/ws/.worktrees/PAY-77',
    key: 'PAY-77',
    name: 'PAY-77',
    source: 'folder' as const,
    why: '',
    folder: '/ws/.worktrees/PAY-77',
    worktrees: [
      {
        repo: '/ws/fe',
        repoName: 'fe',
        path: '/ws/.worktrees/PAY-77/fe',
        branch: 'x',
        head: 'a',
      },
    ],
    hidden: false,
    pending: true,
    done: false,
    notes: '',
    summary: [],
    rule: [],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    useTasksStore.getState().reset()
    useToastStore.setState({ toasts: [] })
    useWorkspaceStore.setState({ root: '/ws' })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('avisa uma vez, e o botão importa a tarefa', async () => {
    const imported = workspace({ imported: true, tasks: [{ ...tech, pending: false }] })
    const importFn = vi.fn(async () => ok(imported))
    installApi({
      task: {
        discover: vi.fn(async () => ok(workspace({ imported: true, tasks: [tech] }))),
        watch: vi.fn(async () => ok(undefined)),
        import: importFn,
      },
    })
    await loadTasks('/ws')
    await vi.advanceTimersByTimeAsync(1500)
    const [toast] = useToastStore.getState().toasts
    expect(toast?.message).toContain('PAY-77')
    // Nova descoberta da mesma tarefa: sem segundo aviso.
    await loadTasks('/ws')
    await vi.advanceTimersByTimeAsync(1500)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    toast?.action?.run()
    await vi.advanceTimersByTimeAsync(0)
    expect(importFn).toHaveBeenCalledWith('/ws', [tech.id], [])
  })
})
