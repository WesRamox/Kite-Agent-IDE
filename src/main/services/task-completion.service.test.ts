import { execFileSync } from 'node:child_process'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { subscribe } from '@parcel/watcher'
import type { Task, WorkspaceTasks } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGitRunner } from '../lib/git-runner'
import { JsonStore } from '../lib/json-store'
import { createLogger } from '../lib/logger'
import { DEFAULT_CONFIG, isDone, setDone, type WorkspaceTaskConfig } from '../lib/task-config'
import { exists } from '../lib/task-worktrees'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { TaskCompletionService } from './task-completion.service'
import { TaskService, taskStateSchema, type TaskState } from './task.service'

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@x',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@x',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' })
const log = createLogger('test', 'error', () => {})

describe('TaskCompletionService', () => {
  let base: string
  let root: string
  let cleanup: () => Promise<void>
  let guard: WorkspaceGuard
  let tasks: TaskService
  let trash: ReturnType<typeof vi.fn<(p: string) => Promise<void>>>
  let svc: TaskCompletionService
  const folder = () => path.join(root, '.worktrees/PAY-412')

  beforeEach(async () => {
    ;({ dir: base, cleanup } = await makeTree({ 'loja/api/a.txt': 'a', 'loja/web/a.txt': 'w' }))
    root = path.join(base, 'loja')
    for (const r of ['api', 'web']) {
      const dir = path.join(root, r)
      git(dir, 'init', '-q', '-b', 'main')
      git(dir, 'add', '.')
      git(dir, 'commit', '-q', '-m', 'i')
      git(dir, 'worktree', 'add', '-q', '-b', 'PAY-412', path.join(folder(), r))
    }
    await writeFile(path.join(folder(), 'TASK.md'), '# Checkout com Pix\n')
    guard = new WorkspaceGuard()
    await guard.addRoot(root)
    tasks = new TaskService({
      guard,
      run: createGitRunner(ENV),
      store: new JsonStore<TaskState>(path.join(base, 'tasks.json'), taskStateSchema, {
        workspaces: {},
      }),
      subscribe,
      emit: () => {},
      pickFolder: async () => null,
      log,
    })
    // A lixeira de verdade é do SO; aqui a pasta só some.
    trash = vi.fn((p: string) => rm(p, { recursive: true, force: true }))
    svc = new TaskCompletionService({
      tasks,
      run: createGitRunner(ENV),
      trash,
      guard,
      log,
      retryDelayMs: 1,
    })
  })

  afterEach(async () => {
    await tasks.unwatch()
    await cleanup()
  })

  const pay = async () => (await tasks.discover(root)).tasks.find((t) => t.key === 'PAY-412')

  it('marca e desmarca a tarefa como concluída', async () => {
    const id = (await pay())?.id ?? ''
    const done = await svc.setDone(root, id, true)
    expect(done.tasks.find((t) => t.id === id)?.done).toBe(true)
    const undone = await svc.setDone(root, id, false)
    expect(undone.tasks.find((t) => t.id === id)?.done).toBe(false)
  })

  it('recusa excluir as worktrees de uma tarefa que não foi concluída', async () => {
    const id = (await pay())?.id ?? ''
    await expect(svc.removeWorktrees(root, id, false)).rejects.toMatchObject({
      code: 'INVALID_ARGS',
    })
    expect(await exists(path.join(folder(), 'api'))).toBe(true)
  })

  it('exclui as worktrees e a pasta da tarefa, mantém as branches e esquece a tarefa', async () => {
    const id = (await pay())?.id ?? ''
    await tasks.rename(root, id, 'Pix')
    await svc.setDone(root, id, true)
    const res = await svc.removeWorktrees(root, id, false)
    expect(res.kind).toBe('removed')
    if (res.kind !== 'removed') return
    expect(res.worktrees.every((w) => w.error === null)).toBe(true)
    expect(res.folderTrashed).toBe(true)
    expect(trash).toHaveBeenCalledWith(folder())
    expect(await exists(folder())).toBe(false)
    expect(res.workspace.tasks.some((t) => t.id === id)).toBe(false)
    for (const r of ['api', 'web']) {
      expect(git(path.join(root, r), 'branch', '--list', 'PAY-412')).toContain('PAY-412')
    }
    // Uma worktree nova da mesma branch volta como tarefa nova, sem o nome nem a conclusão.
    git(path.join(root, 'api'), 'worktree', 'add', '-q', path.join(folder(), 'api'), 'PAY-412')
    const again = await pay()
    expect(again?.done).toBe(false)
    expect(again?.name).not.toBe('Pix')
  })

  it('com alterações não commitadas, só apaga depois da confirmação (force)', async () => {
    const id = (await pay())?.id ?? ''
    await svc.setDone(root, id, true)
    await writeFile(path.join(folder(), 'web', 'novo.txt'), 'x')
    const first = await svc.removeWorktrees(root, id, false)
    expect(first).toEqual({ kind: 'dirty', repos: ['web'] })
    expect(await exists(path.join(folder(), 'api'))).toBe(true)
    const forced = await svc.removeWorktrees(root, id, true)
    expect(forced.kind === 'removed' && forced.worktrees.every((w) => w.error === null)).toBe(true)
    expect(await exists(path.join(folder(), 'web'))).toBe(false)
  })

  it('pasta da tarefa com outros arquivos fica no disco', async () => {
    const id = (await pay())?.id ?? ''
    await svc.setDone(root, id, true)
    await writeFile(path.join(folder(), 'notas.txt'), 'x')
    const res = await svc.removeWorktrees(root, id, false)
    expect(res.kind === 'removed' && res.folderTrashed).toBe(false)
    expect(trash).not.toHaveBeenCalled()
    expect(await exists(path.join(folder(), 'notas.txt'))).toBe(true)
  })
})

describe('TaskCompletionService com dependências falsas', () => {
  const task = (patch: Partial<Task>): Task => ({
    id: 'folder:/ws/.worktrees/x',
    key: 'x',
    name: 'x',
    source: 'folder',
    why: '',
    folder: null,
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
  const workspace = (t: Task, root = '/ws'): WorkspaceTasks => ({
    root,
    repos: [],
    ignoredRepos: [],
    tasks: [t],
    unassigned: [],
    grouping: { mode: 'auto', pattern: '' },
    scanDepth: 2,
    imported: true,
    sessionLinks: {},
  })
  const make = (ws: WorkspaceTasks, run: (cwd: string, args: string[]) => Promise<string>) => {
    const update = vi.fn(
      async (_root: string, _fn: (c: WorkspaceTaskConfig) => WorkspaceTaskConfig) => ws,
    )
    const svc = new TaskCompletionService({
      tasks: { discover: async () => ws, update },
      run,
      trash: vi.fn(async () => {}),
      guard: { removeRoot: vi.fn() },
      log,
      retryDelayMs: 1,
    })
    return { svc, update }
  }

  it('falha num repo não interrompe os outros e a tarefa não é esquecida', async () => {
    const run = vi.fn(async (cwd: string, args: string[]) => {
      if (args[0] === 'worktree' && cwd === '/ws/api') throw new Error('Permission denied')
      return ''
    })
    const { svc, update } = make(workspace(task({})), run)
    const res = await svc.removeWorktrees('/ws', 'folder:/ws/.worktrees/x', false)
    const applied = update.mock.calls[0]?.[1](
      setDone(DEFAULT_CONFIG, 'folder:/ws/.worktrees/x', true),
    )
    expect(applied && isDone(applied, 'folder:/ws/.worktrees/x')).toBe(true)
    expect(res.kind === 'removed' && res.worktrees.map((w) => [w.repoName, !!w.error])).toEqual([
      ['api', true],
      ['web', false],
    ])
    // Tentou de novo antes de desistir (terminal recém-fechado segurando a pasta no Windows).
    expect(
      run.mock.calls.filter(([cwd, a]) => cwd === '/ws/api' && a[0] === 'worktree'),
    ).toHaveLength(3)
  })

  it('recusa apagar uma worktree que contém a pasta aberta', async () => {
    const t = task({})
    const run = vi.fn(async () => '')
    const { svc } = make(workspace(t, '/ws/.worktrees/x/api'), run)
    await expect(svc.removeWorktrees('/ws/.worktrees/x/api', t.id, true)).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('status que falha conta como alteração não commitada', async () => {
    const run = vi.fn(async (_cwd: string, args: string[]) => {
      if (args[0] === 'status') throw new Error('not a git repository')
      return ''
    })
    const { svc } = make(workspace(task({})), run)
    const res = await svc.removeWorktrees('/ws', 'folder:/ws/.worktrees/x', false)
    expect(res).toEqual({ kind: 'dirty', repos: ['api', 'web'] })
    expect(run.mock.calls.some(([, a]) => a[0] === 'worktree')).toBe(false)
  })
})
