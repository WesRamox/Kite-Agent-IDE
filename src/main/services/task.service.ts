import { randomUUID } from 'node:crypto'
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CreateTaskInput, Task, TaskGrouping, WorkspaceTasks } from '@shared/types'
import { AppException } from '../lib/errors'
import type { GitRunner } from '../lib/git-exec'
import { worktreeDirName } from '../lib/git-parse'
import { assertBranchName } from '../lib/git-refs'
import { t } from '../lib/i18n'
import type { JsonStore } from '../lib/json-store'
import type { Logger } from '../lib/logger'
import { scanRepos } from '../lib/repo-scan'
import * as cfgOps from '../lib/task-config'
import { DEFAULT_CONFIG, type TaskState, type WorkspaceTaskConfig } from '../lib/task-config'
import { groupWorktrees, type RepoWorktrees, type TaskOverrides } from '../lib/task-grouping'
import {
  addWorktree,
  commonBranch,
  exists,
  listTaskWorktrees,
  newTaskWorktreeDir,
  readTaskMeta,
} from '../lib/task-worktrees'
import type { WorkspaceGuard } from '../lib/workspace-guard'
import type { SubscribeFn, Subscription } from './watch.service'

export { taskStateSchema, type TaskState, type WorkspaceTaskConfig } from '../lib/task-config'

export interface TaskServiceDeps {
  guard: WorkspaceGuard
  run: GitRunner
  store: JsonStore<TaskState>
  subscribe: SubscribeFn
  emit: (tasks: WorkspaceTasks) => void
  pickFolder: () => Promise<string | null>
  log: Logger
  debounceMs?: number
}

// Tarefas multi-repo do workspace: descoberta, ajustes do usuário e observação de worktrees.
export class TaskService {
  private watched: { root: string; subs: Subscription[] } | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private last = new Map<string, string>()
  // Descobertas em fila: a do watcher e a pedida pelo renderer (ex.: TASK.md mudou) podem se
  // cruzar, e a que começou antes, com o disco antigo, não pode chegar por último.
  private discovering: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: TaskServiceDeps) {}

  async discover(root: string): Promise<WorkspaceTasks> {
    this.checkRoot(root)
    const run = () => this.discoverNow(root)
    const next = this.discovering.then(run, run)
    this.discovering = next.catch(() => {})
    return next
  }

  private async discoverNow(root: string): Promise<WorkspaceTasks> {
    const cfg = await this.config(root)
    const repos = await this.repos(root, cfg)
    const extra = new Set(cfg.extraRepos)
    const listed: RepoWorktrees[] = await Promise.all(
      repos.map(async (repo) => ({
        repo,
        name: path.basename(repo),
        worktrees: await listTaskWorktrees(this.deps.run, repo),
      })),
    )
    const { tasks, unassigned } = groupWorktrees(
      root,
      listed,
      cfg.grouping,
      cfg.overrides as TaskOverrides,
    )
    const full: Task[] = await Promise.all(
      tasks.map(async (t) => {
        const meta = await readTaskMeta([t.folder, ...t.worktrees.map((w) => w.path)])
        return {
          id: t.id,
          key: t.key,
          name: cfg.overrides.names[t.id] ?? meta.title ?? t.key,
          source: t.source,
          why: t.why,
          folder: t.folder,
          worktrees: t.worktrees,
          hidden: cfg.overrides.hidden.includes(t.id),
          notes: cfg.notes[t.id] ?? '',
          summary: meta.summary,
          rule: meta.rule,
        }
      }),
    )
    const result: WorkspaceTasks = {
      root,
      repos: repos.map((p) => ({ path: p, name: path.basename(p), external: extra.has(p) })),
      ignoredRepos: (cfg.ignoredRepos ?? []).map((p) => ({ path: p, name: path.basename(p) })),
      tasks: full,
      unassigned,
      grouping: cfg.grouping,
      imported: cfg.imported,
      sessionLinks: cfg.sessionLinks,
    }
    this.last.set(root, JSON.stringify(result))
    return result
  }

  // Observa o .git de cada repositório: worktree criada, removida ou trocando de branch.
  async watch(root: string): Promise<void> {
    this.checkRoot(root)
    await this.unwatch()
    const cfg = await this.config(root)
    const subs: Subscription[] = []
    for (const repo of await this.repos(root, cfg)) {
      try {
        subs.push(
          await this.deps.subscribe(
            path.join(repo, '.git'),
            (err, events) => {
              if (err) return
              const relevant = events.some(
                (e) =>
                  e.path.includes(`${path.sep}worktrees${path.sep}`) ||
                  e.path.endsWith(`${path.sep}worktrees`),
              )
              if (relevant) this.schedule(root)
            },
            { ignore: ['objects/**', 'logs/**', 'hooks/**', 'lfs/**', 'modules/**'] },
          ),
        )
      } catch (err) {
        this.deps.log.warn('não foi possível observar o repositório', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    this.watched = { root, subs }
  }

  async unwatch(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const subs = this.watched?.subs ?? []
    this.watched = null
    // Falha ao soltar um watcher que já caiu não muda nada para quem fecha.
    await Promise.all(subs.map((s) => s.unsubscribe().catch(() => {})))
  }

  setGrouping(root: string, grouping: TaskGrouping): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.setGrouping(c, grouping))
  }

  rename(root: string, taskId: string, name: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.renameTask(c, taskId, name))
  }

  // Coloca a worktree numa tarefa existente ou numa nova (target 'new').
  async move(root: string, worktree: string, target: string): Promise<WorkspaceTasks> {
    const ws = await this.discover(root)
    const known = [...ws.tasks.flatMap((t) => t.worktrees), ...ws.unassigned]
    const wt = known.find((w) => w.path === worktree)
    if (!wt) throw new AppException('NOT_FOUND', t('error.worktreeNotFound'))
    if (target === 'new') {
      const id = `manual:${randomUUID()}`
      const name = wt.branch ?? path.basename(wt.path)
      return this.update(root, (c) => cfgOps.assignWorktree(c, worktree, id, { id, name }))
    }
    if (!ws.tasks.some((t) => t.id === target)) {
      throw new AppException('NOT_FOUND', t('error.taskNotFound'))
    }
    return this.update(root, (c) => cfgOps.assignWorktree(c, worktree, target))
  }

  ignore(root: string, worktree: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.ignoreWorktree(c, worktree))
  }

  importTasks(root: string, hidden: string[]): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.importTasks(c, hidden))
  }

  setHidden(root: string, taskId: string, hidden: boolean): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.setHidden(c, taskId, hidden))
  }

  setNotes(root: string, taskId: string, notes: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.setNotes(c, taskId, notes))
  }

  linkSession(root: string, sessionId: string, taskId: string | null): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.linkSession(c, sessionId, taskId))
  }

  // Repositório de fora da pasta aberta, escolhido no diálogo nativo.
  async addExternalRepo(root: string): Promise<WorkspaceTasks> {
    this.checkRoot(root)
    const picked = await this.deps.pickFolder()
    if (!picked) return this.discover(root)
    const real = await realpath(picked)
    const isRepo = await stat(path.join(real, '.git')).then(
      (s) => s.isDirectory(),
      () => false,
    )
    if (!isRepo) throw new AppException('NOT_A_REPO', t('error.notARepo'))
    return this.update(root, (c) => cfgOps.addExtraRepo(c, real))
  }

  removeRepo(root: string, repo: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.removeRepo(c, repo))
  }

  restoreRepo(root: string, repo: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.restoreRepo(c, repo))
  }

  removeTask(root: string, taskId: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => cfgOps.removeManualTask(c, taskId))
  }

  // Libera um repositório do workspace ou uma worktree de tarefa para os painéis Git e GitHub
  // (a pasta aberta pode não ser um repositório). Só caminhos que a descoberta conhece.
  async openRepo(root: string, repo: string): Promise<string> {
    const ws = await this.discover(root)
    const known = [
      ...ws.repos.map((r) => r.path),
      ...ws.tasks.flatMap((t) => t.worktrees.map((w) => w.path)),
      ...ws.unassigned.map((w) => w.path),
    ]
    if (!known.includes(repo)) throw new AppException('NOT_FOUND', t('error.notARepo'))
    return this.deps.guard.addRoot(repo)
  }

  // Abre a tarefa: as worktrees (e a pasta da tarefa) viram raízes permitidas.
  async open(root: string, taskId: string): Promise<Task> {
    const ws = await this.discover(root)
    const task = ws.tasks.find((t) => t.id === taskId)
    if (!task) throw new AppException('NOT_FOUND', t('error.taskNotFound'))
    for (const wt of task.worktrees) await this.deps.guard.addRoot(wt.path)
    if (task.folder) await this.deps.guard.addRoot(task.folder)
    return task
  }

  // Cria uma worktree do repositório para a tarefa, na pasta dela ou em ../<repo>-worktrees.
  async addRepo(root: string, taskId: string, repo: string): Promise<WorkspaceTasks> {
    const ws = await this.discover(root)
    const task = ws.tasks.find((t) => t.id === taskId)
    const r = ws.repos.find((x) => x.path === repo)
    if (!task || !r) throw new AppException('NOT_FOUND', t('error.taskOrRepoNotFound'))
    if (task.worktrees.some((w) => w.repo === repo)) {
      throw new AppException('ALREADY_EXISTS', t('error.repoAlreadyInTask', { repo: r.name }))
    }
    const branch = commonBranch(task.worktrees) ?? task.key
    await assertBranchName(this.deps.run, repo, branch)
    const dir = task.folder
      ? path.join(task.folder, r.name)
      : path.join(path.dirname(repo), `${r.name}-worktrees`, worktreeDirName(branch))
    if (await exists(dir))
      throw new AppException('ALREADY_EXISTS', t('error.folderExists', { dir }))
    await addWorktree(this.deps.run, repo, branch, dir)
    if (task.source === 'manual') {
      const real = await realpath(dir)
      await this.update(root, (c) => cfgOps.assignWorktree(c, real, task.id))
    }
    const next = await this.discover(root)
    this.deps.emit(next)
    return next
  }

  // Nova tarefa (Fase 10): uma worktree por repositório, no padrão de pasta do workspace
  // (.worktrees/{tarefa}/{repo} por padrão). Quando a pasta aberta é ela mesma o repositório,
  // a worktree vai para ../<repo>-worktrees/<branch>, como nas fases anteriores.
  async create(root: string, input: CreateTaskInput): Promise<Task> {
    const ws = await this.discover(root)
    const cfg = await this.config(root)
    const repos = input.repos.map((p) => ws.repos.find((r) => r.path === p))
    if (repos.length === 0 || repos.some((r) => !r)) {
      throw new AppException('INVALID_ARGS', t('error.chooseTaskRepos'))
    }
    const name = input.name.trim()
    const branch = input.branch.trim()
    if (!name || !branch) throw new AppException('INVALID_ARGS', t('error.nameAndBranchRequired'))
    const first = repos[0]?.path ?? root
    await assertBranchName(this.deps.run, first, branch)
    const key = worktreeDirName(branch)
    const pattern =
      cfg.grouping.mode === 'pattern' && cfg.grouping.pattern.includes('{repo}')
        ? cfg.grouping.pattern
        : DEFAULT_CONFIG.grouping.pattern
    const single = repos.length === 1 && first === root
    const plan = repos.map((r) => {
      const repo = r as { path: string; name: string }
      return {
        repo,
        dir: newTaskWorktreeDir({ root, single, pattern, key, repoName: repo.name }),
      }
    })
    for (const { dir } of plan) {
      if (await exists(dir))
        throw new AppException('ALREADY_EXISTS', t('error.folderExists', { dir }))
    }
    const created: string[] = []
    for (const { repo, dir } of plan) {
      await addWorktree(this.deps.run, repo.path, branch, dir, repo.name)
      created.push(await realpath(dir))
    }
    // Pasta da tarefa (quando as worktrees ficam juntas): o título vai num TASK.md.
    const folder = single ? null : path.dirname(plan[0]?.dir ?? root)
    if (folder && plan.every((p) => path.dirname(p.dir) === folder)) {
      await mkdir(folder, { recursive: true })
      const file = path.join(folder, 'TASK.md')
      if (!(await exists(file))) await writeFile(file, `# ${name}\n`)
    }
    let ws2 = await this.update(root, (c) => ({ ...c, imported: true }))
    let task = ws2.tasks.find((t) => t.worktrees.some((w) => created.includes(w.path)))
    // Agrupamento manual (ou algo que não juntou as worktrees): monta a tarefa à mão.
    if (!task || !created.every((p) => task?.worktrees.some((w) => w.path === p))) {
      const id = `manual:${randomUUID()}`
      ws2 = await this.update(root, (c) =>
        created.reduce(
          (acc, p, i) => cfgOps.assignWorktree(acc, p, id, i === 0 ? { id, name } : undefined),
          c,
        ),
      )
      task = ws2.tasks.find((t) => t.id === id)
    } else if (task.name !== name) {
      const id = task.id
      ws2 = await this.update(root, (c) => cfgOps.renameTask(c, id, name))
      task = ws2.tasks.find((t) => t.id === id)
    }
    if (!task) throw new AppException('INTERNAL', t('error.createdTaskMissing'))
    this.deps.emit(ws2)
    return task
  }

  // Onde um agente da tarefa roda: a pasta da tarefa ou, sem ela, a primeira worktree.
  async agentTarget(
    root: string,
    taskId: string,
  ): Promise<{ cwd: string; repoPath: string; branch: string; name: string; id: string }> {
    const task = await this.open(root, taskId)
    const first = task.worktrees[0]
    if (!first) throw new AppException('NOT_FOUND', t('error.taskHasNoWorktrees'))
    return {
      cwd: task.folder ?? first.path,
      repoPath: first.repo,
      branch: commonBranch(task.worktrees) ?? task.key,
      name: task.name,
      id: task.id,
    }
  }

  private checkRoot(root: string): void {
    if (!this.deps.guard.isRoot(root)) {
      throw new AppException('FORBIDDEN_PATH', t('error.notAnOpenFolder'))
    }
  }

  private schedule(root: string): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      const before = this.last.get(root)
      this.discover(root)
        .then((ws) => {
          if (JSON.stringify(ws) !== before) this.deps.emit(ws)
        })
        .catch((err: unknown) =>
          this.deps.log.warn('falha ao redescobrir tarefas', {
            error: err instanceof Error ? err.message : String(err),
          }),
        )
    }, this.deps.debounceMs ?? 300)
  }

  private async config(root: string): Promise<WorkspaceTaskConfig> {
    const state = await this.deps.store.read()
    return state.workspaces[root] ?? DEFAULT_CONFIG
  }

  private async update(
    root: string,
    fn: (c: WorkspaceTaskConfig) => WorkspaceTaskConfig,
  ): Promise<WorkspaceTasks> {
    this.checkRoot(root)
    const state = await this.deps.store.read()
    const next = fn(state.workspaces[root] ?? DEFAULT_CONFIG)
    await this.deps.store.write({ workspaces: { ...state.workspaces, [root]: next } })
    return this.discover(root)
  }

  private async repos(root: string, cfg: WorkspaceTaskConfig): Promise<string[]> {
    const ignored = new Set(cfg.ignoredRepos ?? [])
    const scanned = (await scanRepos(root)).filter((r) => !ignored.has(r))
    const extra: string[] = []
    for (const r of cfg.extraRepos) if (await exists(path.join(r, '.git'))) extra.push(r)
    return [...new Set([...scanned, ...extra])]
  }
}
