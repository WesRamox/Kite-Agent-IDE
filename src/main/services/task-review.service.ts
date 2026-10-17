import type {
  DeliverInput,
  DeliverResult,
  GitDiff,
  PullSummary,
  ReviewRepo,
  TaskReview,
  TaskWorktree,
} from '@shared/types'
import { AppException } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { GitHubService } from './github.service'
import type { GitService } from './git.service'
import type { TaskService } from './task.service'

export interface TaskReviewServiceDeps {
  tasks: Pick<TaskService, 'open'>
  git: Pick<
    GitService,
    | 'status'
    | 'changesSince'
    | 'numstatSince'
    | 'commitsSince'
    | 'defaultBase'
    | 'diffSince'
    | 'commitAll'
  >
  github: Pick<GitHubService, 'prForBranch' | 'createPR' | 'updatePRBody' | 'pushCurrent'>
  log: Logger
}

// Nome de branch vindo do renderer vira argumento do git: nada de opções (-x) ou caracteres
// estranhos.
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/

function checkBranch(name: string): string {
  if (!BRANCH.test(name) || name.includes('..')) {
    throw new AppException('INVALID_ARGS', `Branch base inválida: ${name}`)
  }
  return name
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Revisão e entrega de uma tarefa multi-repo (Fase 9): o que mudou em cada repo contra a base,
// commit em lote e PRs com links entre si.
export class TaskReviewService {
  constructor(private readonly deps: TaskReviewServiceDeps) {}

  async review(
    root: string,
    taskId: string,
    bases: Record<string, string> = {},
  ): Promise<TaskReview> {
    const task = await this.deps.tasks.open(root, taskId)
    const repos = await Promise.all(
      task.worktrees.map((w) =>
        this.repo(w, bases[w.path] ? checkBranch(bases[w.path] ?? '') : null),
      ),
    )
    return { taskId, repos }
  }

  async diff(
    root: string,
    taskId: string,
    worktree: string,
    base: string,
    rel: string,
  ): Promise<GitDiff> {
    const w = await this.worktree(root, taskId, worktree)
    const { mergeBase } = await this.deps.git.changesSince(w.path, checkBranch(base))
    return this.deps.git.diffSince(w.path, mergeBase, rel)
  }

  // PR de cada worktree (detalhes da tarefa). Sem login ou sem GitHub: null.
  async prs(root: string, taskId: string): Promise<Record<string, PullSummary | null>> {
    const task = await this.deps.tasks.open(root, taskId)
    const entries = await Promise.all(
      task.worktrees.map(async (w) => [w.path, await this.pr(w.path, w.branch)] as const),
    )
    return Object.fromEntries(entries)
  }

  async deliver(root: string, taskId: string, input: DeliverInput): Promise<DeliverResult[]> {
    const task = await this.deps.tasks.open(root, taskId)
    const selected = task.worktrees.filter((w) => input.worktrees.includes(w.path))
    if (selected.length === 0)
      throw new AppException('INVALID_ARGS', 'Escolha ao menos um repositório')
    const results: DeliverResult[] = []
    // Em série: o push e a criação de PRs pedem o token e falham de forma independente.
    for (const w of selected) results.push(await this.deliverOne(w, input))

    // Links cruzados: cada PR criado agora ganha os links dos outros PRs da tarefa.
    const withPR = results.filter((r) => r.pr)
    if (input.openPRs && withPR.length > 1) {
      for (const r of withPR) {
        if (!r.pr?.created) continue
        const others = withPR
          .filter((o) => o !== r)
          .map((o) => `- ${o.repoName}: ${o.pr?.url ?? ''}`)
          .join('\n')
        const body = `${input.body.trim()}\n\n---\n**PRs desta tarefa:**\n${others}`.trim()
        try {
          await this.deps.github.updatePRBody(r.worktree, r.pr.number, body)
        } catch (err) {
          r.error = `PR criado, mas sem os links dos outros: ${message(err)}`
        }
      }
    }
    return results
  }

  private async deliverOne(w: TaskWorktree, input: DeliverInput): Promise<DeliverResult> {
    const r: DeliverResult = {
      repoName: w.repoName,
      worktree: w.path,
      committed: false,
      pr: null,
      error: null,
    }
    try {
      const status = await this.deps.git.status(w.path)
      if (!status.isRepo) throw new AppException('NOT_A_REPO', 'Não é um repositório Git')
      if (status.files.length > 0) {
        if (!input.message.trim()) {
          throw new AppException('INVALID_ARGS', 'Escreva a mensagem do commit')
        }
        await this.deps.git.commitAll(w.path, input.message.trim())
        r.committed = true
      }
      if (!input.openPRs) return r
      const branch = status.branch
      if (!branch)
        throw new AppException('GIT_ERROR', 'HEAD destacado: crie uma branch antes do PR')
      const existing = await this.pr(w.path, branch)
      if (existing?.state === 'open') {
        await this.deps.github.pushCurrent(w.path)
        r.pr = { number: existing.number, url: existing.url, created: false }
        return r
      }
      const base = checkBranch(
        input.bases[w.path] ?? (await this.deps.git.defaultBase(w.path)) ?? 'main',
      )
      const pr = await this.deps.github.createPR(w.path, {
        title: input.title.trim(),
        body: input.body.trim(),
        base,
        draft: input.draft,
      })
      r.pr = { ...pr, created: true }
    } catch (err) {
      r.error = message(err)
      this.deps.log.warn('falha ao entregar repo da tarefa', { repo: w.repoName })
    }
    return r
  }

  private async repo(w: TaskWorktree, baseOverride: string | null): Promise<ReviewRepo> {
    const out: ReviewRepo = {
      repoName: w.repoName,
      worktree: w.path,
      branch: w.branch,
      base: baseOverride ?? 'main',
      mergeBase: null,
      files: [],
      added: 0,
      deleted: 0,
      uncommitted: 0,
      ahead: 0,
      pr: null,
      error: null,
    }
    try {
      out.base = baseOverride ?? (await this.deps.git.defaultBase(w.path)) ?? 'main'
      const status = await this.deps.git.status(w.path)
      if (status.isRepo) {
        out.uncommitted = status.files.length
        out.branch = status.branch ?? w.branch
      }
      const { mergeBase, files } = await this.deps.git.changesSince(w.path, out.base)
      out.mergeBase = mergeBase
      const untracked = files.filter((f) => f.status === 'untracked').map((f) => f.path)
      const stats = await this.deps.git.numstatSince(w.path, mergeBase, untracked)
      out.files = files.map((f) => ({
        rel: f.path,
        status: f.status,
        added: stats.get(f.path)?.added ?? null,
        deleted: stats.get(f.path)?.deleted ?? null,
      }))
      out.added = out.files.reduce((n, f) => n + (f.added ?? 0), 0)
      out.deleted = out.files.reduce((n, f) => n + (f.deleted ?? 0), 0)
      out.ahead = await this.deps.git.commitsSince(w.path, mergeBase)
    } catch (err) {
      out.error = message(err)
    }
    out.pr = await this.pr(w.path, out.branch)
    return out
  }

  private async pr(worktree: string, branch: string | null): Promise<PullSummary | null> {
    if (!branch) return null
    return this.deps.github.prForBranch(worktree, branch).catch(() => null)
  }

  private async worktree(root: string, taskId: string, path: string): Promise<TaskWorktree> {
    const task = await this.deps.tasks.open(root, taskId)
    const w = task.worktrees.find((x) => x.path === path)
    if (!w) throw new AppException('NOT_FOUND', 'A worktree não é desta tarefa')
    return w
  }
}
