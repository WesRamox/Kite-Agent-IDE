import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SearchQuery, WorkspaceTasks } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGitRunner } from '../lib/git-runner'
import { createLogger } from '../lib/logger'
import { makeTree } from '../test/tmp'
import { SearchService } from './search.service'

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
const q = (patch: Partial<SearchQuery> = {}): SearchQuery => ({
  text: 'pix',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  include: '',
  exclude: '',
  ...patch,
})

describe('SearchService', () => {
  let base: string
  let cleanup: () => Promise<void>
  let svc: SearchService
  const wt = (repo: string) => path.join(base, '.worktrees/PAY-1', repo)

  beforeEach(async () => {
    ;({ dir: base, cleanup } = await makeTree({
      'api/server.ts': 'export const pix = 1\n',
      'api/.gitignore': 'dist\n',
      'web/page.tsx': 'nada aqui\n',
      'outro/x.ts': 'pix fora da tarefa\n',
    }))
    for (const r of ['api', 'web']) {
      const dir = path.join(base, r)
      git(dir, 'init', '-q', '-b', 'main')
      git(dir, 'add', '.')
      git(dir, 'commit', '-q', '-m', 'i')
      git(dir, 'worktree', 'add', '-q', '-b', 'PAY-1', wt(r))
    }
    // Novo (não commitado), ignorado e binário.
    await writeFile(path.join(wt('web'), 'checkout.tsx'), 'const Pix = () => null\n')
    await writeFile(path.join(wt('api'), 'dist'), 'pix compilado\n')
    await writeFile(path.join(wt('api'), 'logo.bin'), Buffer.from([0, 1, 2, 0x70, 0x69, 0x78]))
    const ws: WorkspaceTasks = {
      root: base,
      repos: [],
      ignoredRepos: [],
      tasks: [
        {
          id: 'folder:pay',
          key: 'PAY-1',
          name: 'PAY-1',
          source: 'folder',
          why: '',
          folder: path.join(base, '.worktrees/PAY-1'),
          worktrees: ['api', 'web'].map((r) => ({
            repo: path.join(base, r),
            repoName: r,
            path: wt(r),
            branch: 'PAY-1',
            head: '',
          })),
          hidden: false,
          pending: false,
          done: false,
          notes: '',
          summary: [],
          rule: [],
        },
      ],
      unassigned: [],
      grouping: { mode: 'auto', pattern: '' },
      scanDepth: 2,
      imported: true,
      sessionLinks: {},
    }
    svc = new SearchService({
      tasks: { discover: async () => ws },
      run: createGitRunner(ENV),
      log: createLogger('test', 'error', () => {}),
    })
  })

  afterEach(() => cleanup())

  it('busca só nas worktrees da tarefa, com arquivos novos, sem ignorados nem binários', async () => {
    const res = await svc.searchTask(base, 'folder:pay', q())
    expect(res.repos.map((r) => [r.repoName, r.files.map((f) => f.rel)])).toEqual([
      ['api', ['server.ts']],
      ['web', ['checkout.tsx']],
    ])
    expect(res).toMatchObject({ files: 2, matches: 2, truncated: false })
    expect(res.repos[0]?.files[0]?.path).toBe(path.join(wt('api'), 'server.ts'))
  })

  it('maiúsculas e filtros de arquivos', async () => {
    const strict = await svc.searchTask(base, 'folder:pay', q({ caseSensitive: true }))
    expect(strict.repos.map((r) => r.repoName)).toEqual(['api'])
    const tsx = await svc.searchTask(base, 'folder:pay', q({ include: '*.tsx' }))
    expect(tsx.repos.map((r) => r.repoName)).toEqual(['web'])
    const notApi = await svc.searchTask(base, 'folder:pay', q({ exclude: 'server.ts' }))
    expect(notApi.repos.map((r) => r.repoName)).toEqual(['web'])
  })

  it('sem ocorrências devolve vazio', async () => {
    expect(await svc.searchTask(base, 'folder:pay', q({ text: 'zzz' }))).toEqual({
      repos: [],
      files: 0,
      matches: 0,
      truncated: false,
    })
  })

  it('regex inválida e filtro fora da worktree viram erro com o nome do repo', async () => {
    await expect(
      svc.searchTask(base, 'folder:pay', q({ text: '(', regex: true })),
    ).rejects.toMatchObject({ code: 'INVALID_ARGS', message: expect.stringContaining('api') })
    await expect(
      svc.searchTask(base, 'folder:pay', q({ include: '../../outro/**' })),
    ).rejects.toMatchObject({ code: 'INVALID_ARGS' })
  })

  it('mágica de pathspec no filtro não tira a busca da worktree', async () => {
    const res = await svc.searchTask(base, 'folder:pay', q({ include: ':(top)../../outro/**' }))
    expect(res.matches).toBe(0)
  })

  it('texto que parece opção do git é só texto', async () => {
    await writeFile(path.join(wt('api'), 'notas.md'), 'use --output=x aqui\n')
    const res = await svc.searchTask(base, 'folder:pay', q({ text: '--output=x' }))
    expect(res.repos[0]?.files.map((f) => f.rel)).toEqual(['notas.md'])
  })

  it('recusa tarefa que não existe', async () => {
    await expect(svc.searchTask(base, 'folder:outra', q())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
