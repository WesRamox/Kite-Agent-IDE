// @vitest-environment happy-dom
import type { AgentTask, RemoveWorktreesResult, Task, WorkspaceTasks } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installApi, ok } from '../../test/fake-api'
import { useContextStore } from '../../stores/context.store'
import { useToastStore } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useAgentsStore } from '../agents/agents.store'
import { taskContext, useTasksStore } from './tasks.store'

// Dock falso da tarefa: o que importa é se as abas (e com elas os terminais) foram fechadas.
const removePanel = vi.fn()
vi.mock('../../lib/dock', async (orig) => ({
  ...(await orig<object>()),
  getDock: () => ({ panels: [{ id: 'terminal-1' }], removePanel }),
  getDockApi: () => null,
}))
vi.mock('../git/git-sync.actions', () => ({ refreshGit: vi.fn(async () => {}) }))
const { removeTaskWorktrees, setTaskDone } = await import('./task-completion.actions')

const task = (patch: Partial<Task> = {}): Task => ({
  id: 'folder:/ws/.worktrees/x',
  key: 'x',
  name: 'Pix',
  source: 'folder',
  why: '',
  folder: '/ws/.worktrees/x',
  worktrees: [
    { repo: '/ws/api', repoName: 'api', path: '/ws/.worktrees/x/api', branch: 'x', head: 'a' },
    { repo: '/ws/web', repoName: 'web', path: '/ws/.worktrees/x/web', branch: 'x', head: 'b' },
  ],
  hidden: false,
  pending: false,
  done: true,
  notes: '',
  summary: [],
  rule: [],
  ...patch,
})
const workspace = (tasks: Task[]): WorkspaceTasks => ({
  root: '/ws',
  repos: [],
  ignoredRepos: [],
  tasks,
  unassigned: [],
  grouping: { mode: 'auto', pattern: '' },
  scanDepth: 2,
  imported: true,
  sessionLinks: {},
})
const removed = (errors: Record<string, string> = {}): RemoveWorktreesResult => ({
  kind: 'removed',
  worktrees: task().worktrees.map((w) => ({
    repoName: w.repoName,
    path: w.path,
    error: errors[w.repoName] ?? null,
  })),
  folderTrashed: Object.keys(errors).length === 0,
  workspace: workspace([]),
})
const agent = (patch: Partial<AgentTask>): AgentTask => ({
  id: 'a',
  name: 'agente',
  presetId: 'claude',
  presetName: 'Claude',
  branch: 'x',
  baseBranch: '',
  worktreePath: '/ws/.worktrees/x',
  repoPath: '/ws/api',
  status: 'running',
  alive: true,
  interrupted: false,
  startedAt: 0,
  endedAt: null,
  exitCode: null,
  ...patch,
})
const toasts = () => useToastStore.getState().toasts

describe('tarefa concluída', () => {
  beforeEach(() => {
    removePanel.mockClear()
    useTasksStore.getState().reset()
    useTasksStore.getState().set({ workspace: workspace([task()]) })
    useWorkspaceStore.setState({ root: '/ws' })
    useToastStore.setState({ toasts: [] })
    useAgentsStore.setState({ tasks: [] })
    useContextStore.getState().reset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('marcar como concluída aplica o workspace e oferece excluir as worktrees', async () => {
    const setDone = vi.fn(async () => ok(workspace([task()])))
    installApi({ task: { setDone } })
    await setTaskDone(task().id, true)
    expect(setDone).toHaveBeenCalledWith('/ws', task().id, true)
    expect(toasts()[0]?.action).toBeDefined()
  })

  it('desmarcar não mostra aviso', async () => {
    installApi({ task: { setDone: vi.fn(async () => ok(workspace([task({ done: false })]))) } })
    await setTaskDone(task().id, false)
    expect(useTasksStore.getState().workspace?.tasks[0]?.done).toBe(false)
    expect(toasts()).toHaveLength(0)
  })

  it('cancelar a confirmação não apaga nada nem fecha a tarefa', async () => {
    const removeWorktrees = vi.fn()
    installApi({
      dialog: { confirm: vi.fn(async () => ok(1)) },
      task: { removeWorktrees },
    })
    await removeTaskWorktrees(task().id)
    expect(removeWorktrees).not.toHaveBeenCalled()
    expect(removePanel).not.toHaveBeenCalled()
  })

  it('com alterações não commitadas, pergunta de novo e só então força', async () => {
    const removeWorktrees = vi.fn(async (_r: string, _id: string, force: boolean) =>
      ok<RemoveWorktreesResult>(force ? removed() : { kind: 'dirty', repos: ['web'] }),
    )
    const confirm = vi.fn(async () => ok(0))
    const unwatch = vi.fn(async () => ok(undefined))
    const stop = vi.fn(async () => ok(undefined))
    installApi({
      dialog: { confirm },
      task: { removeWorktrees },
      fs: { unwatch },
      git: { unwatch },
      agent: { stop },
    })
    useAgentsStore.setState({
      tasks: [agent({ id: 'a1', wsTaskId: task().id }), agent({ id: 'a2', alive: false })],
    })
    useContextStore.getState().activate(taskContext(task().id))
    useTasksStore.getState().set({ activeTaskId: task().id })

    await removeTaskWorktrees(task().id)

    expect(confirm).toHaveBeenCalledTimes(2)
    expect(removeWorktrees.mock.calls.map((c) => c[2])).toEqual([false, true])
    expect(stop.mock.calls).toEqual([['a1']])
    expect(removePanel).toHaveBeenCalled()
    expect(unwatch).toHaveBeenCalledTimes(4)
    expect(useTasksStore.getState().activeTaskId).toBeNull()
    expect(useContextStore.getState().contexts).not.toContain(taskContext(task().id))
    expect(useTasksStore.getState().workspace?.tasks).toEqual([])
    expect(toasts()[0]?.kind).toBe('info')
  })

  it('recusar a segunda confirmação não força', async () => {
    const removeWorktrees = vi.fn(async () =>
      ok<RemoveWorktreesResult>({ kind: 'dirty', repos: ['web'] }),
    )
    const confirm = vi.fn().mockResolvedValueOnce(ok(0)).mockResolvedValueOnce(ok(1))
    installApi({
      dialog: { confirm },
      task: { removeWorktrees },
      fs: { unwatch: vi.fn(async () => ok(undefined)) },
      git: { unwatch: vi.fn(async () => ok(undefined)) },
    })
    await removeTaskWorktrees(task().id)
    expect(removeWorktrees).toHaveBeenCalledTimes(1)
  })

  it('falha num repo aparece como erro com o nome do repo', async () => {
    installApi({
      dialog: { confirm: vi.fn(async () => ok(0)) },
      task: { removeWorktrees: vi.fn(async () => ok(removed({ api: 'Permission denied' }))) },
      fs: { unwatch: vi.fn(async () => ok(undefined)) },
      git: { unwatch: vi.fn(async () => ok(undefined)) },
    })
    await removeTaskWorktrees(task().id)
    expect(toasts()[0]?.kind).toBe('error')
    expect(toasts()[0]?.message).toContain('api (Permission denied)')
  })
})
