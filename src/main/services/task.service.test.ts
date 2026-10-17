import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { subscribe } from '@parcel/watcher'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGitRunner } from '../lib/git-runner'
import { JsonStore } from '../lib/json-store'
import { createLogger } from '../lib/logger'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
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

describe('TaskService', () => {
  let base: string
  let root: string
  let cleanup: () => Promise<void>
  let guard: WorkspaceGuard
  let emit: ReturnType<typeof vi.fn<(ws: unknown) => void>>
  let svc: TaskService

  beforeEach(async () => {
    ;({ dir: base, cleanup } = await makeTree({
      'loja/api/a.txt': 'a',
      'loja/web/a.txt': 'w',
      'loja/infra/a.txt': 'i',
      'loja/node_modules/pkg/.keep': '',
    }))
    root = path.join(base, 'loja')
    for (const r of ['api', 'web', 'infra']) {
      const dir = path.join(root, r)
      git(dir, 'init', '-q', '-b', 'main')
      git(dir, 'add', '.')
      git(dir, 'commit', '-q', '-m', 'i')
    }
    // Layout 1: pasta da tarefa dentro do workspace.
    git(
      path.join(root, 'api'),
      'worktree',
      'add',
      '-q',
      '-b',
      'PAY-412',
      path.join(root, '.worktrees/PAY-412/api'),
    )
    git(
      path.join(root, 'web'),
      'worktree',
      'add',
      '-q',
      '-b',
      'PAY-412',
      path.join(root, '.worktrees/PAY-412/web'),
    )
    await writeFile(path.join(root, '.worktrees/PAY-412/TASK.md'), '# Checkout com Pix\n')
    // Layout 2: pastas de worktrees por repo, fora do workspace, mesma branch.
    git(
      path.join(root, 'api'),
      'worktree',
      'add',
      '-q',
      '-b',
      'feat/OPS-19',
      path.join(base, 'api-worktrees/OPS-19'),
    )
    git(
      path.join(root, 'infra'),
      'worktree',
      'add',
      '-q',
      '-b',
      'feat/OPS-19',
      path.join(base, 'infra-worktrees/OPS-19'),
    )
    // Layout 3: uma worktree só, com o nome do repo.
    git(
      path.join(root, 'web'),
      'worktree',
      'add',
      '-q',
      '-b',
      'SEO-4',
      path.join(root, '.worktrees/SEO-4/web'),
    )

    guard = new WorkspaceGuard()
    root = await guard.addRoot(root)
    emit = vi.fn<(ws: unknown) => void>()
    svc = new TaskService({
      guard,
      run: createGitRunner(ENV),
      store: new JsonStore<TaskState>(path.join(base, 'tasks.json'), taskStateSchema, {
        workspaces: {},
      }),
      subscribe,
      emit,
      pickFolder: async () => null,
      log: createLogger('test', 'error', () => {}),
      debounceMs: 100,
    })
  })

  afterEach(async () => {
    await svc.unwatch()
    await cleanup()
  })

  it('descobre os repositórios e agrupa os três layouts', async () => {
    const ws = await svc.discover(root)
    expect(ws.repos.map((r) => r.name)).toEqual(['api', 'infra', 'web'])
    expect(ws.tasks.map((t) => [t.key, t.name, t.worktrees.map((w) => w.repoName)])).toEqual([
      ['OPS-19', 'OPS-19', ['api', 'infra']],
      ['PAY-412', 'Checkout com Pix', ['api', 'web']],
      ['SEO-4', 'SEO-4', ['web']],
    ])
    expect(ws.imported).toBe(false)
  })

  it('ajustes persistem: renomear, importar escondendo uma, notas e vínculo de sessão', async () => {
    const ws = await svc.discover(root)
    const pay = ws.tasks.find((t) => t.key === 'PAY-412')?.id ?? ''
    const seo = ws.tasks.find((t) => t.key === 'SEO-4')?.id ?? ''
    await svc.rename(root, pay, 'Pix no checkout')
    await svc.setNotes(root, pay, 'usar túnel de staging')
    await svc.linkSession(root, 'sess-1', pay)
    const after = await svc.importTasks(root, [seo])
    expect(after.imported).toBe(true)
    expect(after.tasks.find((t) => t.id === pay)).toMatchObject({
      name: 'Pix no checkout',
      notes: 'usar túnel de staging',
      hidden: false,
    })
    expect(after.tasks.find((t) => t.id === seo)?.hidden).toBe(true)
    expect(after.sessionLinks).toEqual({ 'sess-1': pay })
  })

  it('abrir a tarefa libera as worktrees, inclusive as de fora do workspace', async () => {
    const ws = await svc.discover(root)
    const ops = ws.tasks.find((t) => t.key === 'OPS-19')
    expect(guard.isRoot(ops?.worktrees[0]?.path ?? '')).toBe(false)
    await svc.open(root, ops?.id ?? '')
    for (const w of ops?.worktrees ?? []) expect(guard.isRoot(w.path)).toBe(true)
    await expect(svc.open(root, 'folder:/nao/existe')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('adiciona um repositório à tarefa criando a worktree na pasta dela', async () => {
    const ws = await svc.discover(root)
    const pay = ws.tasks.find((t) => t.key === 'PAY-412')
    const next = await svc.addRepo(root, pay?.id ?? '', path.join(root, 'infra'))
    const updated = next.tasks.find((t) => t.id === pay?.id)
    expect(updated?.worktrees.map((w) => w.repoName)).toEqual(['api', 'infra', 'web'])
    expect(updated?.worktrees.find((w) => w.repoName === 'infra')).toMatchObject({
      path: path.join(root, '.worktrees/PAY-412/infra'),
      branch: 'PAY-412',
    })
    await expect(svc.addRepo(root, pay?.id ?? '', path.join(root, 'infra'))).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    })
  })

  it('worktree nova criada por fora aparece sozinha', async () => {
    await svc.discover(root)
    await svc.watch(root)
    git(
      path.join(root, 'api'),
      'worktree',
      'add',
      '-q',
      '-b',
      'MOB-52',
      path.join(root, '.worktrees/MOB-52/api'),
    )
    await vi.waitFor(
      () => {
        const last = emit.mock.calls.at(-1)?.[0] as { tasks: { key: string }[] } | undefined
        expect(last?.tasks.map((t) => t.key)).toContain('MOB-52')
      },
      { timeout: 3000 },
    )
  })

  it('recusa raiz que não está aberta', async () => {
    await expect(svc.discover('/tmp')).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
  })
})
