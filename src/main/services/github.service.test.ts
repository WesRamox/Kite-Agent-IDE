import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Octokit } from '@octokit/rest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGitRunner } from '../lib/git-runner'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { GitService } from './git.service'
import { GitHubService, summarizeChecks } from './github.service'

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' })

const pr = (n: number, extra: object = {}) => ({
  number: n,
  title: `PR ${n}`,
  user: { login: 'dev' },
  state: 'open',
  draft: false,
  merged_at: null,
  head: { ref: 'feat/login', sha: 'abc123', repo: { full_name: 'acme/app' } },
  base: { ref: 'main' },
  updated_at: '2026-10-01T00:00:00Z',
  html_url: `https://github.com/acme/app/pull/${n}`,
  body: 'descrição',
  additions: 3,
  deletions: 1,
  changed_files: 2,
  mergeable: true,
  ...extra,
})

function fakeOctokit() {
  const api = {
    rest: {
      repos: {
        get: vi.fn(async () => ({
          data: { default_branch: 'main', html_url: 'https://github.com/acme/app', private: true },
        })),
        getCombinedStatusForRef: vi.fn(async () => ({
          data: {
            statuses: [{ context: 'ci/legacy', state: 'success', target_url: 'https://ci' }],
          },
        })),
      },
      pulls: {
        list: vi.fn(async () => ({
          data: [
            pr(1),
            pr(2, {
              merged_at: '2026-01-01',
              state: 'closed',
              head: { ref: 'x', sha: 's', repo: { full_name: 'fork/app' } },
            }),
          ],
        })),
        get: vi.fn(async ({ pull_number }: { pull_number: number }) => ({ data: pr(pull_number) })),
        create: vi.fn(async () => ({
          data: { number: 9, html_url: 'https://github.com/acme/app/pull/9' },
        })),
      },
      issues: {
        listForRepo: vi.fn(async () => ({
          data: [
            {
              number: 5,
              title: 'Bug',
              user: { login: 'u' },
              state: 'open',
              labels: [{ name: 'bug', color: 'ff0000' }],
              comments: 2,
              updated_at: 'x',
              html_url: 'h',
            },
            {
              number: 1,
              title: 'PR 1',
              user: null,
              state: 'open',
              labels: [],
              comments: 0,
              updated_at: 'x',
              html_url: 'h',
              pull_request: {},
            },
          ],
        })),
        get: vi.fn(async () => ({
          data: {
            number: 5,
            title: 'Bug',
            user: null,
            state: 'closed',
            labels: ['x'],
            comments: 0,
            updated_at: 'u',
            html_url: 'h',
            body: null,
          },
        })),
      },
      checks: {
        listForRef: vi.fn(async () => ({
          data: {
            check_runs: [
              {
                name: 'build',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://run',
              },
            ],
          },
        })),
      },
    },
  }
  return api
}

describe('summarizeChecks', () => {
  it('prioriza falha, depois pendente', () => {
    expect(summarizeChecks([])).toBe('none')
    expect(summarizeChecks([{ status: 'completed', conclusion: 'success' }])).toBe('success')
    expect(
      summarizeChecks([
        { status: 'in_progress', conclusion: null },
        { status: 'completed', conclusion: 'success' },
      ]),
    ).toBe('pending')
    expect(
      summarizeChecks([
        { status: 'in_progress', conclusion: null },
        { status: 'completed', conclusion: 'failure' },
      ]),
    ).toBe('failure')
  })
})

describe('GitHubService', () => {
  let base: string
  let repo: string
  let bare: string
  let cleanup: () => Promise<void>
  let api: ReturnType<typeof fakeOctokit>
  let svc: GitHubService
  let guard: WorkspaceGuard

  beforeEach(async () => {
    ;({ dir: base, cleanup } = await makeTree({ 'repo/a.txt': 'a\n' }))
    repo = path.join(base, 'repo')
    bare = path.join(base, 'origin.git')
    git(base, 'init', '-q', '--bare', '-b', 'main', bare)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'inicial')
    git(repo, 'remote', 'add', 'origin', 'https://github.com/acme/app.git')
    // O "github.com" deste repositório é o bare local.
    git(repo, 'config', `url.${bare}.insteadOf`, 'https://github.com/acme/app.git')
    git(repo, 'push', '-q', 'origin', 'main')
    guard = new WorkspaceGuard()
    await guard.addRoot(repo)
    api = fakeOctokit()
    svc = new GitHubService({
      getToken: async () => 'gho_t',
      octokit: () => api as unknown as Octokit,
      git: new GitService({ guard, run: createGitRunner(ENV) }),
      host: 'github.com',
    })
  })
  afterEach(() => cleanup())

  it('detecta o repositório pelo origin', async () => {
    await expect(svc.repo(repo)).resolves.toEqual({
      owner: 'acme',
      repo: 'app',
      defaultBranch: 'main',
      url: 'https://github.com/acme/app',
      private: true,
    })
  })

  it('sem remote do GitHub: null / erro claro', async () => {
    git(repo, 'remote', 'set-url', 'origin', 'https://gitlab.com/x/y.git')
    await expect(svc.repo(repo)).resolves.toBeNull()
    await expect(svc.listPRs(repo, 'open')).rejects.toMatchObject({ code: 'NOT_GITHUB_REPO' })
  })

  it('lista PRs (merged, forks) e issues sem PRs', async () => {
    const prs = await svc.listPRs(repo, 'all')
    expect(api.rest.pulls.list).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'acme', repo: 'app', state: 'all' }),
    )
    expect(prs.map((p) => [p.number, p.state, p.fromFork])).toEqual([
      [1, 'open', false],
      [2, 'merged', true],
    ])
    const issues = await svc.listIssues(repo, 'open')
    expect(issues.map((i) => i.number)).toEqual([5])
    expect(issues[0]?.labels).toEqual([{ name: 'bug', color: 'ff0000' }])
  })

  it('detalhe do PR junta check runs e status', async () => {
    const detail = await svc.getPR(repo, 1)
    expect(detail).toMatchObject({ number: 1, body: 'descrição', changedFiles: 2 })
    expect(detail.checks.state).toBe('success')
    expect(detail.checks.runs.map((r) => r.name)).toEqual(['build', 'ci/legacy'])
  })

  it('erros da API viram mensagens de domínio', async () => {
    api.rest.pulls.list.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }))
    await expect(svc.listPRs(repo, 'open')).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' })
    api.rest.pulls.create.mockRejectedValueOnce(
      Object.assign(new Error('x'), {
        status: 422,
        response: { data: { errors: [{ message: 'A pull request already exists' }] } },
      }),
    )
    git(repo, 'switch', '-q', '-c', 'feat/dup')
    await expect(
      svc.createPR(repo, { title: 't', body: '', base: 'main', draft: false }),
    ).rejects.toMatchObject({
      code: 'GITHUB_ERROR',
      message: 'A pull request already exists',
    })
  })

  it('cria PR: faz push da branch atual e chama a API', async () => {
    git(repo, 'switch', '-q', '-c', 'feat/novo')
    await writeFile(path.join(repo, 'a.txt'), 'b\n')
    git(repo, 'commit', '-q', '-am', 'mudança')
    const res = await svc.createPR(repo, {
      title: 'Novo',
      body: 'corpo',
      base: 'main',
      draft: true,
    })
    expect(res).toEqual({ number: 9, url: 'https://github.com/acme/app/pull/9' })
    expect(api.rest.pulls.create).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'app',
      title: 'Novo',
      body: 'corpo',
      head: 'feat/novo',
      base: 'main',
      draft: true,
    })
    expect(git(bare, 'log', '-1', '--format=%s', 'feat/novo').trim()).toBe('mudança')
    expect(git(repo, 'rev-parse', '--abbrev-ref', '@{upstream}').trim()).toBe('origin/feat/novo')
  })

  it('recusa PR da própria base', async () => {
    await expect(
      svc.createPR(repo, { title: 't', body: '', base: 'main', draft: false }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGS',
    })
  })

  it('abre o PR numa worktree (refs/pull/N/head) e reaproveita depois', async () => {
    // Simula o PR #1 no "GitHub": um commit publicado em refs/pull/1/head.
    git(repo, 'switch', '-q', '-c', 'tmp')
    await writeFile(path.join(repo, 'a.txt'), 'do PR\n')
    git(repo, 'commit', '-q', '-am', 'commit do PR')
    git(repo, 'push', '-q', 'origin', 'HEAD:refs/pull/1/head')
    git(repo, 'switch', '-q', 'main')
    git(repo, 'branch', '-q', '-D', 'tmp')

    const first = await svc.checkoutPR(repo, 1)
    expect(first.branch).toBe('feat/login')
    expect(first.path).toContain(path.join('repo-worktrees', 'feat-login'))
    await expect(readFile(path.join(first.path, 'a.txt'), 'utf8')).resolves.toBe('do PR\n')
    await expect(readFile(path.join(repo, 'a.txt'), 'utf8')).resolves.toBe('a\n')

    await expect(svc.checkoutPR(repo, 1)).resolves.toEqual(first)
  })

  it('usa pr-N quando a branch do PR já existe localmente', async () => {
    git(repo, 'branch', 'feat/login')
    git(repo, 'push', '-q', 'origin', 'main:refs/pull/1/head')
    await expect(svc.checkoutPR(repo, 1)).resolves.toMatchObject({ branch: 'pr-1' })
  })
})
