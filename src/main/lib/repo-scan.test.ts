import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { makeTree } from '../test/tmp'
import { scanRepos } from './repo-scan'

describe('scanRepos', () => {
  let cleanup: (() => Promise<void>) | undefined
  afterEach(async () => {
    await cleanup?.()
    cleanup = undefined
  })

  const tree = async (spec: Record<string, string>) => {
    const t = await makeTree(spec)
    cleanup = t.cleanup
    return t.dir
  }
  const rel = (dir: string, list: string[]) => list.map((r) => path.relative(dir, r))
  const noWorktrees = { depth: 2, worktreeDirs: [] }

  it('acha repositórios até a profundidade pedida e ignora node_modules e pastas ocultas', async () => {
    const dir = await tree({
      'api/.git/': '',
      'grupo/web/.git/': '',
      'grupo/fundo/demais/.git/': '',
      'node_modules/pkg/.git/': '',
      '.cache/x/.git/': '',
    })
    expect(rel(dir, (await scanRepos(dir, noWorktrees)).repos)).toEqual([
      'api',
      path.join('grupo', 'web'),
    ])
    expect(rel(dir, (await scanRepos(dir, { depth: 3, worktreeDirs: [] })).repos)).toEqual([
      'api',
      path.join('grupo', 'fundo', 'demais'),
      path.join('grupo', 'web'),
    ])
  })

  it('acha repositórios dentro de outro repositório', async () => {
    const dir = await tree({
      'plataforma/.git/': '',
      'plataforma/api-core/.git/': '',
      'plataforma/web-app/.git/': '',
    })
    expect(rel(dir, (await scanRepos(dir, noWorktrees)).repos)).toEqual([
      'plataforma',
      path.join('plataforma', 'api-core'),
      path.join('plataforma', 'web-app'),
    ])
  })

  it('lista worktrees e submódulos (.git arquivo), inclusive na pasta de worktrees oculta', async () => {
    const dir = await tree({
      'api/.git/': '',
      'api/lib/.git': 'gitdir: ../.git/modules/lib\n',
      '.worktrees/PAY-77/web/.git': 'gitdir: /x/.git/worktrees/web\n',
      '.worktrees/PAY-77/TASK.md': '# t\n',
      '.outra/PAY-78/web/.git': 'gitdir: /x/.git/worktrees/web2\n',
    })
    const { repos, linked } = await scanRepos(dir, {
      depth: 2,
      worktreeDirs: [{ dir: path.join(dir, '.worktrees'), levels: 2 }],
    })
    expect(rel(dir, repos)).toEqual(['api'])
    expect(rel(dir, linked)).toEqual([
      path.join('.worktrees', 'PAY-77', 'web'),
      path.join('api', 'lib'),
    ])
  })

  it('a pasta de worktrees vem do padrão: qualquer nome e qualquer número de níveis', async () => {
    const dir = await tree({
      'tarefas/fundo/PAY-1-web/.git': 'gitdir: /x/.git/worktrees/a\n',
      'tarefas/fundo/x/y/.git': 'gitdir: /x/.git/worktrees/b\n',
    })
    const { linked } = await scanRepos(dir, {
      depth: 0,
      worktreeDirs: [{ dir: path.join(dir, 'tarefas/fundo'), levels: 1 }],
    })
    expect(rel(dir, linked)).toEqual([path.join('tarefas', 'fundo', 'PAY-1-web')])
  })

  it('pasta aberta que é uma worktree não conta como worktree a resolver', async () => {
    const dir = await tree({ '.git': 'gitdir: /x/.git/worktrees/wt\n', 'a.txt': 'a' })
    expect(await scanRepos(dir, noWorktrees)).toEqual({ repos: [], linked: [] })
  })
})
