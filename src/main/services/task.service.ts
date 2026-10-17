import { randomUUID } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { Task, TaskGrouping, WorkspaceTasks } from '@shared/types'
import { AppException } from '../lib/errors'
import { parseWorktrees, worktreeDirName } from '../lib/git-parse'
import type { JsonStore } from '../lib/json-store'
import type { Logger } from '../lib/logger'
import { scanRepos } from '../lib/repo-scan'
import {
  EMPTY_OVERRIDES,
  groupWorktrees,
  parseTaskMeta,
  type RepoWorktrees,
  type TaskOverrides,
} from '../lib/task-grouping'
import type { WorkspaceGuard } from '../lib/workspace-guard'
import type { GitRunner } from './git.service'
import type { SubscribeFn, Subscription } from './watch.service'

const configSchema = z.object({
  grouping: z.object({
    mode: z.enum(['auto', 'pattern', 'manual']),
    pattern: z.string().max(200),
  }),
  overrides: z.object({
    names: z.record(z.string(), z.string().max(120)),
    moves: z.record(z.string(), z.string()),
    ignored: z.array(z.string()),
    manual: z.array(z.object({ id: z.string(), name: z.string().max(120) })),
    hidden: z.array(z.string()),
  }),
  extraRepos: z.array(z.string()),
  imported: z.boolean(),
  notes: z.record(z.string(), z.string().max(20_000)),
  sessionLinks: z.record(z.string(), z.string()),
})

export type WorkspaceTaskConfig = z.infer<typeof configSchema>

export const taskStateSchema = z.object({ workspaces: z.record(z.string(), configSchema) })
export type TaskState = z.infer<typeof taskStateSchema>

const DEFAULT_CONFIG: WorkspaceTaskConfig = {
  grouping: { mode: 'auto', pattern: '.worktrees/{tarefa}/{repo}' },
  overrides: EMPTY_OVERRIDES,
  extraRepos: [],
  imported: false,
  notes: {},
  sessionLinks: {},
}

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

const META_FILES: [string, 'json' | 'md'][] = [
  ['.kite-task.json', 'json'],
  ['TASK.md', 'md'],
]

// Tarefas multi-repo do workspace: descoberta, ajustes do usuário e observação de worktrees.
export class TaskService {
  private watched: { root: string; subs: Subscription[] } | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private last = new Map<string, string>()

  constructor(private readonly deps: TaskServiceDeps) {}

  async discover(root: string): Promise<WorkspaceTasks> {
    this.checkRoot(root)
    const cfg = await this.config(root)
    const repos = await this.repos(root, cfg)
    const listed: RepoWorktrees[] = await Promise.all(
      repos.map(async (repo) => ({
        repo,
        name: path.basename(repo),
        worktrees: await this.worktreesOf(repo),
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
        const meta = await this.meta([t.folder, ...t.worktrees.map((w) => w.path)])
        return {
          id: t.id,
          key: t.key,
          name: cfg.overrides.names[t.id] ?? meta.title ?? t.key,
          cardUrl: meta.url,
          source: t.source,
          why: t.why,
          folder: t.folder,
          worktrees: t.worktrees,
          hidden: cfg.overrides.hidden.includes(t.id),
          notes: cfg.notes[t.id] ?? '',
        }
      }),
    )
    const result: WorkspaceTasks = {
      root,
      repos: repos.map((p) => ({ path: p, name: path.basename(p) })),
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
          error: (err as Error).message,
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
    await Promise.all(subs.map((s) => s.unsubscribe().catch(() => {})))
  }

  setGrouping(root: string, grouping: TaskGrouping): Promise<WorkspaceTasks> {
    return this.update(root, (c) => ({ ...c, grouping }))
  }

  rename(root: string, taskId: string, name: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => {
      const others = Object.entries(c.overrides.names).filter(([id]) => id !== taskId)
      const names = Object.fromEntries(name.trim() ? [...others, [taskId, name.trim()]] : others)
      const manual = c.overrides.manual.map((m) =>
        m.id === taskId && name.trim() ? { ...m, name: name.trim() } : m,
      )
      return { ...c, overrides: { ...c.overrides, names, manual } }
    })
  }

  // Coloca a worktree numa tarefa existente ou numa nova (target 'new').
  async move(root: string, worktree: string, target: string): Promise<WorkspaceTasks> {
    const ws = await this.discover(root)
    const known = [...ws.tasks.flatMap((t) => t.worktrees), ...ws.unassigned]
    const wt = known.find((w) => w.path === worktree)
    if (!wt) throw new AppException('NOT_FOUND', 'Worktree não encontrada')
    return this.update(root, (c) => {
      let manual = c.overrides.manual
      let dest = target
      if (target === 'new') {
        dest = `manual:${randomUUID()}`
        const name = wt.branch ?? path.basename(wt.path)
        manual = [...manual, { id: dest, name }]
      } else if (!ws.tasks.some((t) => t.id === target)) {
        throw new AppException('NOT_FOUND', 'Tarefa não encontrada')
      }
      return {
        ...c,
        overrides: { ...c.overrides, manual, moves: { ...c.overrides.moves, [worktree]: dest } },
      }
    })
  }

  ignore(root: string, worktree: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => ({
      ...c,
      overrides: { ...c.overrides, ignored: [...new Set([...c.overrides.ignored, worktree])] },
    }))
  }

  // Conclui a descoberta: as tarefas desmarcadas ficam escondidas da Central.
  importTasks(root: string, hidden: string[]): Promise<WorkspaceTasks> {
    return this.update(root, (c) => ({
      ...c,
      imported: true,
      overrides: { ...c.overrides, hidden: [...new Set(hidden)] },
    }))
  }

  setHidden(root: string, taskId: string, hidden: boolean): Promise<WorkspaceTasks> {
    return this.update(root, (c) => {
      const set = new Set(c.overrides.hidden)
      if (hidden) set.add(taskId)
      else set.delete(taskId)
      return { ...c, overrides: { ...c.overrides, hidden: [...set] } }
    })
  }

  setNotes(root: string, taskId: string, notes: string): Promise<WorkspaceTasks> {
    return this.update(root, (c) => ({ ...c, notes: { ...c.notes, [taskId]: notes } }))
  }

  linkSession(root: string, sessionId: string, taskId: string | null): Promise<WorkspaceTasks> {
    return this.update(root, (c) => {
      const others = Object.entries(c.sessionLinks).filter(([id]) => id !== sessionId)
      const sessionLinks = Object.fromEntries(taskId ? [...others, [sessionId, taskId]] : others)
      return { ...c, sessionLinks }
    })
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
    if (!isRepo) throw new AppException('NOT_A_REPO', 'A pasta não é um repositório Git')
    return this.update(root, (c) => ({ ...c, extraRepos: [...new Set([...c.extraRepos, real])] }))
  }

  // Abre a tarefa: as worktrees (e a pasta da tarefa) viram raízes permitidas.
  async open(root: string, taskId: string): Promise<Task> {
    const ws = await this.discover(root)
    const task = ws.tasks.find((t) => t.id === taskId)
    if (!task) throw new AppException('NOT_FOUND', 'Tarefa não encontrada')
    for (const wt of task.worktrees) await this.deps.guard.addRoot(wt.path)
    if (task.folder) await this.deps.guard.addRoot(task.folder)
    return task
  }

  // Cria uma worktree do repositório para a tarefa, na pasta dela ou em ../<repo>-worktrees.
  async addRepo(root: string, taskId: string, repo: string): Promise<WorkspaceTasks> {
    const ws = await this.discover(root)
    const task = ws.tasks.find((t) => t.id === taskId)
    const r = ws.repos.find((x) => x.path === repo)
    if (!task || !r) throw new AppException('NOT_FOUND', 'Tarefa ou repositório não encontrado')
    if (task.worktrees.some((w) => w.repo === repo)) {
      throw new AppException('ALREADY_EXISTS', `${r.name} já está nesta tarefa`)
    }
    const branch = commonBranch(task) ?? task.key
    await this.deps.run(repo, ['check-ref-format', '--branch', branch]).catch(() => {
      throw new AppException('INVALID_ARGS', `Nome de branch inválido: ${branch}`)
    })
    const dir = task.folder
      ? path.join(task.folder, r.name)
      : path.join(path.dirname(repo), `${r.name}-worktrees`, worktreeDirName(branch))
    if (await exists(dir)) throw new AppException('ALREADY_EXISTS', `A pasta ${dir} já existe`)
    // `rev-parse --verify -q` falha em silêncio: a saída vazia é que indica "não existe".
    const hasBranch = await this.deps
      .run(repo, ['rev-parse', '--verify', '-q', `refs/heads/${branch}^{commit}`])
      .then(
        (out) => out.trim() !== '',
        () => false,
      )
    try {
      await this.deps.run(
        repo,
        hasBranch
          ? ['worktree', 'add', dir, branch]
          : ['worktree', 'add', '-b', branch, dir, 'HEAD'],
      )
    } catch (err) {
      throw new AppException('GIT_ERROR', (err as Error).message)
    }
    if (task.source === 'manual') {
      const real = await realpath(dir)
      await this.update(root, (c) => ({
        ...c,
        overrides: { ...c.overrides, moves: { ...c.overrides.moves, [real]: task.id } },
      }))
    }
    const next = await this.discover(root)
    this.deps.emit(next)
    return next
  }

  private checkRoot(root: string): void {
    if (!this.deps.guard.isRoot(root)) {
      throw new AppException('FORBIDDEN_PATH', 'Não é uma pasta aberta')
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
          this.deps.log.warn('falha ao redescobrir tarefas', { error: (err as Error).message }),
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
    const scanned = await scanRepos(root)
    const extra: string[] = []
    for (const r of cfg.extraRepos) if (await exists(path.join(r, '.git'))) extra.push(r)
    return [...new Set([...scanned, ...extra])]
  }

  private async worktreesOf(repo: string): Promise<RepoWorktrees['worktrees']> {
    let out: string
    try {
      out = await this.deps.run(repo, ['worktree', 'list', '--porcelain'])
    } catch {
      return []
    }
    const list = parseWorktrees(out, repo).filter((w) => !w.isMain && !w.prunable)
    return Promise.all(
      list.map(async (w) => ({
        path: await realpath(w.path).catch(() => w.path),
        branch: w.branch,
        head: w.head,
      })),
    )
  }

  private async meta(
    dirs: (string | null)[],
  ): Promise<{ title: string | null; url: string | null }> {
    for (const dir of dirs) {
      if (!dir) continue
      for (const [name, kind] of META_FILES) {
        const content = await readFile(path.join(dir, name), 'utf8').catch(() => null)
        if (content === null || content.length > 200_000) continue
        const meta = parseTaskMeta(kind, content)
        if (meta.title || meta.url) return meta
      }
    }
    return { title: null, url: null }
  }
}

function commonBranch(task: Task): string | null {
  const counts = new Map<string, number>()
  for (const w of task.worktrees)
    if (w.branch) counts.set(w.branch, (counts.get(w.branch) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  )
}
