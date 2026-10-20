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

  it('acha repositórios até dois níveis e ignora node_modules e pastas ocultas', async () => {
    const dir = await tree({
      'api/.git/': '',
      'grupo/web/.git/': '',
      'grupo/fundo/demais/.git/': '',
      'node_modules/pkg/.git/': '',
      '.cache/x/.git/': '',
    })
    const { repos } = await scanRepos(dir)
    expect(repos.map((r) => path.relative(dir, r))).toEqual(['api', path.join('grupo', 'web')])
  })

  it('acha repositórios dentro de outro repositório', async () => {
    const dir = await tree({
      'plataforma/.git/': '',
      'plataforma/api-core/.git/': '',
      'plataforma/web-app/.git/': '',
    })
    const { repos } = await scanRepos(dir)
    expect(repos.map((r) => path.relative(dir, r))).toEqual([
      'plataforma',
      path.join('plataforma', 'api-core'),
      path.join('plataforma', 'web-app'),
    ])
  })

  it('lista worktrees e submódulos (.git arquivo), inclusive dentro de .worktrees', async () => {
    const dir = await tree({
      'api/.git/': '',
      'api/lib/.git': 'gitdir: ../.git/modules/lib\n',
      '.worktrees/PAY-77/web/.git': 'gitdir: /x/.git/worktrees/web\n',
      '.worktrees/PAY-77/TASK.md': '# t\n',
      '.worktrees/solta/.git': 'gitdir: /x/.git/worktrees/solta\n',
    })
    const { repos, linked } = await scanRepos(dir)
    expect(repos.map((r) => path.relative(dir, r))).toEqual(['api'])
    expect(linked.map((r) => path.relative(dir, r))).toEqual([
      path.join('.worktrees', 'PAY-77', 'web'),
      path.join('.worktrees', 'solta'),
      path.join('api', 'lib'),
    ])
  })

  it('pasta aberta que é uma worktree não conta como worktree a resolver', async () => {
    const dir = await tree({ '.git': 'gitdir: /x/.git/worktrees/wt\n', 'a.txt': 'a' })
    expect(await scanRepos(dir)).toEqual({ repos: [], linked: [] })
  })
})
