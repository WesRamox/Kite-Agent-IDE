import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
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
  const deps = () => ({
    guard,
    run: createGitRunner(ENV),
    store: new JsonStore<TaskState>(path.join(base, 'tasks.json'), taskStateSchema, {
      workspaces: {},
    }),
    subscribe,
    emit,
    pickFolder: async (): Promise<string | null> => null,
    log: createLogger('test', 'error', () => {}),
    debounceMs: 100,
  })

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
    svc = new TaskService(deps())
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

  it('descobertas em fila: a que começou depois nunca é passada para trás pela anterior', async () => {
    // A primeira descoberta (ex.: a do watcher de worktrees) demora; no meio, o agente escreve o
    // resumo e uma segunda descoberta é pedida. A ordem de chegada tem de ser a de início.
    const real = createGitRunner(ENV)
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    let slowFirst = true
    const slow = new TaskService({
      ...deps(),
      run: async (cwd, args, env) => {
        if (slowFirst) {
          slowFirst = false
          await gate
        }
        return real(cwd, args, env)
      },
    })
    const order: string[] = []
    const first = slow.discover(root).then((ws) => (order.push('primeira'), ws))
    await writeFile(
      path.join(root, '.worktrees/PAY-412/TASK.md'),
      '# Checkout com Pix\n\nAceitar Pix no checkout.\n',
    )
    const second = slow.discover(root).then((ws) => (order.push('segunda'), ws))
    setTimeout(release, 50)
    const [, latest] = await Promise.all([first, second])
    expect(order).toEqual(['primeira', 'segunda'])
    expect(latest.tasks.find((t) => t.key === 'PAY-412')?.summary).toEqual([
      'Aceitar Pix no checkout.',
    ])
  })

  it('traz o resumo escrito no TASK.md da tarefa', async () => {
    await writeFile(
      path.join(root, '.worktrees/PAY-412/TASK.md'),
      '# Checkout com Pix\n\nAceitar Pix no checkout.\n',
    )
    const ws = await svc.discover(root)
    expect(ws.tasks.find((t) => t.key === 'PAY-412')?.summary).toEqual(['Aceitar Pix no checkout.'])
    expect(ws.tasks.find((t) => t.key === 'SEO-4')?.summary).toEqual([])
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

  it('separa e desfaz tarefas manuais; tarefa sem worktrees some', async () => {
    const ws = await svc.discover(root)
    const pay = ws.tasks.find((t) => t.key === 'PAY-412')
    const web = pay?.worktrees.find((w) => w.repoName === 'web')?.path ?? ''
    const split = await svc.move(root, web, 'new')
    const manual = split.tasks.find((t) => t.source === 'manual')
    expect(manual?.worktrees.map((w) => w.path)).toEqual([web])
    expect(split.tasks.find((t) => t.key === 'PAY-412')?.worktrees.map((w) => w.repoName)).toEqual([
      'api',
    ])
    await svc.linkSession(root, 'sess-1', manual?.id ?? '')

    // Desfazer devolve a worktree à tarefa da heurística e limpa o vínculo.
    const undone = await svc.removeTask(root, manual?.id ?? '')
    expect(undone.tasks.some((t) => t.source === 'manual')).toBe(false)
    expect(undone.tasks.find((t) => t.key === 'PAY-412')?.worktrees).toHaveLength(2)
    expect(undone.sessionLinks).toEqual({})
    await expect(svc.removeTask(root, pay?.id ?? '')).rejects.toMatchObject({
      code: 'INVALID_ARGS',
    })

    // Tarefa manual cuja worktree foi removida por fora não fica vazia na lista.
    const again = await svc.move(root, web, 'new')
    expect(again.tasks.some((t) => t.source === 'manual')).toBe(true)
    git(path.join(root, 'web'), 'worktree', 'remove', '--force', web)
    const gone = await svc.discover(root)
    expect(gone.tasks.some((t) => t.source === 'manual')).toBe(false)
  })

  it('remove repo de outra pasta e tira do workspace (com volta) o achado na varredura', async () => {
    const outro = path.join(base, 'outro')
    await mkdir(outro)
    git(outro, 'init', '-q', '-b', 'main')
    svc = new TaskService({ ...deps(), pickFolder: async () => outro })
    const added = await svc.addExternalRepo(root)
    expect(added.repos.find((r) => r.name === 'outro')).toMatchObject({ external: true })
    expect((await svc.removeRepo(root, outro)).repos.map((r) => r.name)).toEqual([
      'api',
      'infra',
      'web',
    ])

    const infra = path.join(root, 'infra')
    const ignored = await svc.removeRepo(root, infra)
    expect(ignored.repos.map((r) => r.name)).toEqual(['api', 'web'])
    expect(ignored.ignoredRepos).toEqual([{ path: infra, name: 'infra' }])
    expect(ignored.tasks.find((t) => t.key === 'OPS-19')?.worktrees.map((w) => w.repoName)).toEqual(
      ['api'],
    )
    const restored = await svc.restoreRepo(root, infra)
    expect(restored.repos.map((r) => r.name)).toEqual(['api', 'infra', 'web'])
    expect(restored.ignoredRepos).toEqual([])
  })

  it('libera para o git só repos e worktrees que a descoberta conhece', async () => {
    const api = path.join(root, 'api')
    const ops = path.join(base, 'api-worktrees/OPS-19')
    expect(guard.isRoot(api)).toBe(false)
    await expect(svc.openRepo(root, api)).resolves.toBe(api)
    await expect(svc.openRepo(root, ops)).resolves.toBe(ops)
    expect(guard.isRoot(api) && guard.isRoot(ops)).toBe(true)
    await expect(svc.openRepo(root, path.join(base, 'outro'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
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

  it('cria uma tarefa com 2 repos no padrão de pasta, com TASK.md, e já importada', async () => {
    const task = await svc.create(root, {
      name: 'Estorno parcial',
      branch: 'PAY-415',
      repos: [path.join(root, 'api'), path.join(root, 'web')],
    })
    expect(task).toMatchObject({
      key: 'PAY-415',
      name: 'Estorno parcial',
      folder: path.join(root, '.worktrees/PAY-415'),
    })
    expect(task.worktrees.map((w) => [w.repoName, w.path, w.branch])).toEqual([
      ['api', path.join(root, '.worktrees/PAY-415/api'), 'PAY-415'],
      ['web', path.join(root, '.worktrees/PAY-415/web'), 'PAY-415'],
    ])
    const ws = await svc.discover(root)
    expect(ws.imported).toBe(true)
    expect(await svc.agentTarget(root, task.id)).toMatchObject({
      cwd: path.join(root, '.worktrees/PAY-415'),
      branch: 'PAY-415',
      name: 'Estorno parcial',
    })
    await expect(
      svc.create(root, { name: 'x', branch: 'PAY-415', repos: [path.join(root, 'api')] }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' })
    await expect(
      svc.create(root, { name: 'x', branch: 'a..b', repos: [path.join(root, 'api')] }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGS' })
  })

  it('padrão configurado e modo manual também valem para tarefas novas', async () => {
    await svc.setGrouping(root, { mode: 'pattern', pattern: 'trabalho/{tarefa}/{repo}' })
    const t1 = await svc.create(root, {
      name: 'Infra',
      branch: 'OPS-20',
      repos: [path.join(root, 'infra')],
    })
    expect(t1.worktrees[0]?.path).toBe(path.join(root, 'trabalho/OPS-20/infra'))
    await svc.setGrouping(root, { mode: 'manual', pattern: '' })
    const t2 = await svc.create(root, {
      name: 'Manual',
      branch: 'M-1',
      repos: [path.join(root, 'api'), path.join(root, 'web')],
    })
    expect(t2).toMatchObject({ source: 'manual', name: 'Manual' })
    expect(t2.worktrees).toHaveLength(2)
  })

  it('recusa raiz que não está aberta', async () => {
    await expect(svc.discover('/tmp')).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
  })
})
