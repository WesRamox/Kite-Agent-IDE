import type { Octokit } from '@octokit/rest'
import type {
  ChecksState,
  ChecksSummary,
  CreatePullInput,
  GitHubItemState,
  GitHubRepoRef,
  GitHubUser,
  IssueDetail,
  IssueSummary,
  PullDetail,
  PullSummary,
} from '@shared/types'
import { AppException } from '../lib/errors'
import { gitAuthEnv, parseGitHubRemote, type RemoteRef } from '../lib/github-remote'
import type { GitService } from './git.service'

export type OctokitFactory = (token: string) => Octokit

export interface GitHubServiceDeps {
  getToken: () => Promise<string>
  octokit: OctokitFactory
  git: GitService
  host: string
}

interface Context {
  ref: RemoteRef
  token: string
  api: Octokit
}

const PAGE = 50

export class GitHubService {
  constructor(private readonly deps: GitHubServiceDeps) {}

  async repo(root: string): Promise<GitHubRepoRef | null> {
    const ref = await this.remote(root)
    if (!ref) return null
    const { api } = await this.context(root, ref)
    const { data } = await call(() => api.rest.repos.get({ owner: ref.owner, repo: ref.repo }))
    return {
      owner: ref.owner,
      repo: ref.repo,
      defaultBranch: data.default_branch,
      url: data.html_url,
      private: data.private,
    }
  }

  async listPRs(root: string, state: GitHubItemState): Promise<PullSummary[]> {
    const { ref, api } = await this.context(root)
    const { data } = await call(() =>
      api.rest.pulls.list({
        owner: ref.owner,
        repo: ref.repo,
        state,
        sort: 'updated',
        direction: 'desc',
        per_page: PAGE,
      }),
    )
    return data.map((p) => toPullSummary(p, ref))
  }

  async listIssues(root: string, state: GitHubItemState): Promise<IssueSummary[]> {
    const { ref, api } = await this.context(root)
    const { data } = await call(() =>
      api.rest.issues.listForRepo({
        owner: ref.owner,
        repo: ref.repo,
        state,
        sort: 'updated',
        direction: 'desc',
        per_page: PAGE,
      }),
    )
    // A API de issues também devolve PRs; eles têm o campo pull_request.
    return data.filter((i) => !i.pull_request).map(toIssueSummary)
  }

  async getPR(root: string, number: number): Promise<PullDetail> {
    const { ref, api } = await this.context(root)
    const { data: pr } = await call(() =>
      api.rest.pulls.get({ owner: ref.owner, repo: ref.repo, pull_number: number }),
    )
    const checks = await this.checks(api, ref, pr.head.sha)
    return {
      ...toPullSummary(pr, ref),
      body: pr.body ?? '',
      headSha: pr.head.sha,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      mergeable: pr.mergeable,
      checks,
    }
  }

  async getIssue(root: string, number: number): Promise<IssueDetail> {
    const { ref, api } = await this.context(root)
    const { data } = await call(() =>
      api.rest.issues.get({ owner: ref.owner, repo: ref.repo, issue_number: number }),
    )
    return { ...toIssueSummary(data), body: data.body ?? '' }
  }

  // Envia a branch atual e abre o PR a partir dela.
  async createPR(root: string, input: CreatePullInput): Promise<{ number: number; url: string }> {
    const status = await this.deps.git.status(root)
    if (!status.isRepo) throw new AppException('NOT_A_REPO', 'A pasta não é um repositório Git')
    const branch = status.branch
    if (!branch) throw new AppException('GIT_ERROR', 'HEAD destacado: crie uma branch antes do PR')
    if (branch === input.base) {
      throw new AppException('INVALID_ARGS', `A branch atual já é a base (${branch})`)
    }
    const ctx = await this.context(root)
    await this.deps.git.push(root, branch, this.authEnv(ctx))
    const { data } = await call(() =>
      ctx.api.rest.pulls.create({
        owner: ctx.ref.owner,
        repo: ctx.ref.repo,
        title: input.title,
        body: input.body,
        head: branch,
        base: input.base,
        draft: input.draft,
      }),
    )
    return { number: data.number, url: data.html_url }
  }

  // Baixa o PR numa branch local e abre uma worktree para ela (ou reaproveita a existente).
  async checkoutPR(root: string, number: number): Promise<{ path: string; branch: string }> {
    const ctx = await this.context(root)
    const { data: pr } = await call(() =>
      ctx.api.rest.pulls.get({ owner: ctx.ref.owner, repo: ctx.ref.repo, pull_number: number }),
    )
    const fallback = `pr-${number}`
    const worktrees = await this.deps.git.worktrees(root)
    const existing = worktrees.find(
      (w) => !w.isMain && (w.branch === fallback || w.branch === pr.head.ref),
    )
    if (existing?.branch) return { path: existing.path, branch: existing.branch }

    // Usa o nome da branch do PR se ele estiver livre localmente; senão pr-<n>.
    const branch = (await this.deps.git.branchExists(root, pr.head.ref)) ? fallback : pr.head.ref
    await this.deps.git.fetchPullRef(root, number, branch, this.authEnv(ctx))
    const { path } = await this.deps.git.addWorktree(root, branch, false)
    return { path, branch }
  }

  private authEnv(ctx: Context): Record<string, string> {
    return ctx.ref.protocol === 'https' ? gitAuthEnv(ctx.token, this.deps.host) : {}
  }

  private async checks(api: Octokit, ref: RemoteRef, sha: string): Promise<ChecksSummary> {
    const [runs, status] = await Promise.all([
      call(() =>
        api.rest.checks.listForRef({ owner: ref.owner, repo: ref.repo, ref: sha, per_page: 100 }),
      ),
      call(() =>
        api.rest.repos.getCombinedStatusForRef({ owner: ref.owner, repo: ref.repo, ref: sha }),
      ),
    ])
    const all = [
      ...runs.data.check_runs.map((r) => ({
        name: r.name,
        status: r.status,
        conclusion: r.conclusion ?? null,
        url: r.html_url ?? null,
      })),
      ...status.data.statuses.map((s) => ({
        name: s.context,
        status: s.state,
        conclusion: s.state === 'pending' ? null : s.state,
        url: s.target_url ?? null,
      })),
    ]
    return { state: summarizeChecks(all), runs: all }
  }

  private async remote(root: string): Promise<RemoteRef | null> {
    const url = await this.deps.git.remoteUrl(root, 'origin')
    return url ? parseGitHubRemote(url, this.deps.host) : null
  }

  private async context(root: string, known?: RemoteRef): Promise<Context> {
    const ref = known ?? (await this.remote(root))
    if (!ref) {
      throw new AppException('NOT_GITHUB_REPO', 'O remote origin não é um repositório do GitHub')
    }
    const token = await this.deps.getToken()
    return { ref, token, api: this.deps.octokit(token) }
  }
}

const FAILED = new Set([
  'failure',
  'error',
  'cancelled',
  'timed_out',
  'action_required',
  'startup_failure',
])

export function summarizeChecks(
  runs: { status: string; conclusion: string | null }[],
): ChecksState {
  if (runs.length === 0) return 'none'
  if (runs.some((r) => r.conclusion && FAILED.has(r.conclusion))) return 'failure'
  if (runs.some((r) => !r.conclusion || r.status === 'pending')) return 'pending'
  return 'success'
}

export async function fetchGitHubUser(api: Octokit): Promise<GitHubUser> {
  const { data } = await call(() => api.rest.users.getAuthenticated())
  return { login: data.login, name: data.name ?? null, avatarUrl: data.avatar_url }
}

interface PullLike {
  number: number
  title: string
  user: { login: string } | null
  state: string
  draft?: boolean
  merged_at: string | null
  head: { ref: string; repo: { full_name: string } | null }
  base: { ref: string }
  updated_at: string
  html_url: string
}

function toPullSummary(p: PullLike, ref: RemoteRef): PullSummary {
  return {
    number: p.number,
    title: p.title,
    author: p.user?.login ?? null,
    state: p.merged_at ? 'merged' : p.state === 'open' ? 'open' : 'closed',
    draft: p.draft ?? false,
    headRef: p.head.ref,
    baseRef: p.base.ref,
    updatedAt: p.updated_at,
    url: p.html_url,
    fromFork:
      (p.head.repo?.full_name ?? '').toLowerCase() !== `${ref.owner}/${ref.repo}`.toLowerCase(),
  }
}

interface IssueLike {
  number: number
  title: string
  user: { login: string } | null
  state: string
  labels: (string | { name?: string; color?: string | null })[]
  comments: number
  updated_at: string
  html_url: string
}

function toIssueSummary(i: IssueLike): IssueSummary {
  return {
    number: i.number,
    title: i.title,
    author: i.user?.login ?? null,
    state: i.state === 'open' ? 'open' : 'closed',
    labels: i.labels.map((l) =>
      typeof l === 'string'
        ? { name: l, color: '888888' }
        : { name: l.name ?? '', color: l.color ?? '888888' },
    ),
    comments: i.comments,
    updatedAt: i.updated_at,
    url: i.html_url,
  }
}

// Converte erros do Octokit em erros de domínio com mensagens úteis.
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const status = (err as { status?: unknown }).status
    const response = (
      err as { response?: { data?: { message?: string; errors?: { message?: string }[] } } }
    ).response
    const detail = response?.data?.errors?.[0]?.message ?? response?.data?.message
    if (status === 401)
      throw new AppException('NOT_AUTHENTICATED', 'Sessão do GitHub expirada; entre de novo')
    if (status === 404)
      throw new AppException('NOT_FOUND', 'Não encontrado no GitHub (ou sem acesso)')
    if (status === 403) {
      throw new AppException(
        'GITHUB_ERROR',
        detail ?? 'Acesso negado pelo GitHub (permissões ou limite de requisições)',
      )
    }
    if (typeof status === 'number') {
      throw new AppException('GITHUB_ERROR', detail ?? `Erro do GitHub (${status})`)
    }
    throw new AppException('GITHUB_ERROR', 'Sem conexão com o GitHub')
  }
}
