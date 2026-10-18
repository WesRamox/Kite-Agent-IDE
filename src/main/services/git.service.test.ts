import { execFileSync } from 'node:child_process'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGitRunner } from '../lib/git-runner'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { GitService } from './git.service'

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Teste',
  GIT_AUTHOR_EMAIL: 'teste@example.com',
  GIT_COMMITTER_NAME: 'Teste',
  GIT_COMMITTER_EMAIL: 'teste@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' })
}

describe('GitService', () => {
  let base: string
  let repo: string
  let cleanup: () => Promise<void>
  let guard: WorkspaceGuard
  let svc: GitService
  const p = (...parts: string[]) => path.join(repo, ...parts)

  beforeEach(async () => {
    ;({ dir: base, cleanup } = await makeTree({
      'repo/a.txt': 'um\n',
      'repo/src/b.ts': 'export {}\n',
      'solta/x.txt': '',
    }))
    repo = path.join(base, 'repo')
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'inicial')
    guard = new WorkspaceGuard()
    await guard.addRoot(repo)
    svc = new GitService({ guard, run: createGitRunner(ENV) })
  })
  afterEach(() => cleanup())

  it('reporta pasta que não é repositório', async () => {
    await guard.addRoot(path.join(base, 'solta'))
    await expect(svc.status(path.join(base, 'solta'))).resolves.toEqual({ isRepo: false })
  })

  it('status com branch, modificados e não rastreados', async () => {
    await writeFile(p('a.txt'), 'dois\n')
    await writeFile(p('novo.txt'), 'n\n')
    const status = await svc.status(repo)
    expect(status).toMatchObject({
      isRepo: true,
      branch: 'main',
      worktreePath: repo,
      isMainWorktree: true,
    })
    if (!status.isRepo) throw new Error()
    expect(status.files).toEqual(
      expect.arrayContaining([
        { path: p('a.txt'), staged: null, unstaged: 'modified' },
        { path: p('novo.txt'), staged: null, unstaged: 'untracked' },
      ]),
    )
  })

  it('stage, unstage e commit', async () => {
    await writeFile(p('a.txt'), 'dois\n')
    await svc.stage(repo, [p('a.txt')])
    let status = await svc.status(repo)
    expect(status.isRepo && status.files[0]).toMatchObject({ staged: 'modified', unstaged: null })

    await svc.unstage(repo, [p('a.txt')])
    status = await svc.status(repo)
    expect(status.isRepo && status.files[0]).toMatchObject({ staged: null, unstaged: 'modified' })

    await expect(svc.commit(repo, 'msg')).rejects.toMatchObject({ code: 'GIT_ERROR' })
    await svc.stage(repo, [p('a.txt')])
    const { hash } = await svc.commit(repo, 'segundo')
    expect(hash).toMatch(/^[0-9a-f]{7,}$/)
    expect(git(repo, 'log', '-1', '--format=%s').trim()).toBe('segundo')
  })

  it('stage registra remoções', async () => {
    await import('node:fs/promises').then((fs) => fs.rm(p('a.txt')))
    await svc.stage(repo, [p('a.txt')])
    const status = await svc.status(repo)
    expect(status.isRepo && status.files[0]).toMatchObject({ staged: 'deleted', unstaged: null })
  })

  it('unstage funciona em repositório sem commits', async () => {
    const fresh = path.join(base, 'solta')
    git(fresh, 'init', '-q')
    await guard.addRoot(fresh)
    await svc.stage(fresh, [path.join(fresh, 'x.txt')])
    await svc.unstage(fresh, [path.join(fresh, 'x.txt')])
    const status = await svc.status(fresh)
    expect(status.isRepo && status.files[0]).toMatchObject({ staged: null, unstaged: 'untracked' })
  })

  it('diff não staged (index × disco) e staged (HEAD × index)', async () => {
    await writeFile(p('a.txt'), 'dois\n')
    await expect(svc.diff(repo, p('a.txt'), false)).resolves.toEqual({
      original: 'um\n',
      modified: 'dois\n',
      binary: false,
    })
    await svc.stage(repo, [p('a.txt')])
    await writeFile(p('a.txt'), 'tres\n')
    await expect(svc.diff(repo, p('a.txt'), true)).resolves.toMatchObject({
      original: 'um\n',
      modified: 'dois\n',
    })
    await writeFile(p('novo.txt'), 'n\n')
    await expect(svc.diff(repo, p('novo.txt'), false)).resolves.toMatchObject({
      original: '',
      modified: 'n\n',
    })
  })

  it('branchExists distingue branches existentes', async () => {
    await expect(svc.branchExists(repo, 'main')).resolves.toBe(true)
    await expect(svc.branchExists(repo, 'nao-existe')).resolves.toBe(false)
  })

  it('recusa caminhos fora da pasta aberta', async () => {
    await expect(svc.stage(repo, [path.join(base, 'solta', 'x.txt')])).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    await expect(svc.status(path.join(base, 'solta'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })

  it('branches, criação e troca', async () => {
    await svc.checkout(repo, 'feat/x', true)
    expect((await svc.branches(repo)).map((b) => [b.name, b.current])).toEqual([
      ['feat/x', true],
      ['main', false],
    ])
    await svc.checkout(repo, 'main', false)
    const status = await svc.status(repo)
    expect(status.isRepo && status.branch).toBe('main')
  })

  it('recusa nomes de branch inválidos ou que pareçam opções', async () => {
    for (const bad of ['-f', '--orphan=x', 'a..b', 'com espaço', 'x.lock']) {
      await expect(svc.checkout(repo, bad, true)).rejects.toMatchObject({ code: 'INVALID_ARGS' })
    }
  })

  it('cria, lista e remove worktrees na pasta irmã padrão', async () => {
    const { path: wt } = await svc.addWorktree(repo, 'feat/login', true)
    expect(wt).toBe(await realpath(path.join(base, 'repo-worktrees', 'feat-login')))
    expect((await stat(path.join(wt, 'a.txt'))).isFile()).toBe(true)

    const list = await svc.worktrees(repo)
    expect(list.map((w) => [w.path, w.branch, w.isMain, w.isCurrent])).toEqual([
      [repo, 'main', true, true],
      [wt, 'feat/login', false, false],
    ])
    await expect(svc.isWorktreeOf(repo, wt)).resolves.toBe(true)
    await expect(svc.isWorktreeOf(repo, path.join(base, 'solta'))).resolves.toBe(false)

    await expect(svc.addWorktree(repo, 'feat/login', true)).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    })
    await expect(svc.removeWorktree(repo, repo, false)).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    await svc.removeWorktree(repo, wt, false)
    expect(await svc.worktrees(repo)).toHaveLength(1)
  })

  it('commit numa worktree não afeta a principal', async () => {
    const { path: wt } = await svc.addWorktree(repo, 'feat/y', true)
    await guard.addRoot(wt)
    await writeFile(path.join(wt, 'a.txt'), 'na worktree\n')
    await svc.stage(wt, [path.join(wt, 'a.txt')])
    await svc.commit(wt, 'na worktree')
    const status = await svc.status(wt)
    expect(status).toMatchObject({ branch: 'feat/y', isMainWorktree: false, files: [] })
    await expect(readFile(p('a.txt'), 'utf8')).resolves.toBe('um\n')
    expect(git(repo, 'log', '-1', '--format=%s', 'main').trim()).toBe('inicial')
  })

  it('revisão de tarefa: base padrão, +/- desde o merge-base, commits à frente e commit de tudo', async () => {
    expect(await svc.defaultBase(repo)).toBe('main')
    git(repo, 'switch', '-q', '-c', 'PAY-412')
    await writeFile(p('a.txt'), 'um\ndois\ntres\n')
    git(repo, 'commit', '-q', '-am', 'mais linhas')
    await writeFile(p('novo.ts'), 'linha 1\nlinha 2\n')
    const mergeBase = git(repo, 'merge-base', 'main', 'HEAD').trim()
    expect(await svc.commitsSince(repo, mergeBase)).toBe(1)
    const stats = await svc.numstatSince(repo, mergeBase, ['novo.ts'])
    expect(stats.get('a.txt')).toEqual({ added: 2, deleted: 0 })
    expect(stats.get('novo.ts')).toEqual({ added: 2, deleted: 0 })
    await svc.commitAll(repo, 'adiciona novo.ts')
    expect(git(repo, 'status', '--porcelain').trim()).toBe('')
    expect(await svc.commitsSince(repo, mergeBase)).toBe(2)
  })

  it('status de subpasta só lista arquivos dela', async () => {
    await writeFile(p('a.txt'), 'x\n')
    await writeFile(p('src', 'b.ts'), 'y\n')
    await mkdir(p('src', 'dir'))
    await guard.addRoot(p('src'))
    const status = await svc.status(p('src'))
    expect(status.isRepo && status.files.map((f) => f.path)).toEqual([p('src', 'b.ts')])
  })

  it('changesSince lista commitados, não commitados e novos desde o merge-base', async () => {
    const { path: wt } = await svc.addWorktree(repo, 'agent/x', true)
    await writeFile(path.join(wt, 'a.txt'), 'commitado\n')
    git(wt, 'commit', '-q', '-am', 'agente')
    await writeFile(path.join(wt, 'src', 'b.ts'), 'sujo\n')
    await writeFile(path.join(wt, 'novo.md'), 'n\n')
    // A main andar depois não entra na revisão.
    await writeFile(p('a.txt'), 'main andou\n')
    git(repo, 'commit', '-q', '-am', 'main')

    const review = await svc.changesSince(wt, 'main')
    expect(review.files).toEqual([
      { path: 'a.txt', status: 'modified' },
      { path: 'novo.md', status: 'untracked' },
      { path: 'src/b.ts', status: 'modified' },
    ])
    await expect(svc.diffSince(wt, review.mergeBase, 'a.txt')).resolves.toEqual({
      original: 'um\n',
      modified: 'commitado\n',
      binary: false,
    })
    await expect(svc.diffSince(wt, review.mergeBase, '../fora')).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })

  it('pendingFiles mostra só os arquivos dados que ainda têm alterações, em qualquer repo', async () => {
    await writeFile(p('a.txt'), 'dois\n')
    await mkdir(p('nova'))
    await writeFile(p('nova', 'c.md'), 'c\n')
    execFileSync('rm', [p('src', 'b.ts')])
    const outro = path.join(base, 'outro')
    await mkdir(outro)
    git(outro, 'init', '-q', '-b', 'main')
    await writeFile(path.join(outro, 'x.ts'), 'x\n')

    const files = await svc.pendingFiles([
      p('a.txt'),
      p('nova', 'c.md'),
      p('src', 'b.ts'),
      p('limpo.txt'),
      path.join(outro, 'x.ts'),
      path.join(base, 'solta', 'x.txt'),
      'relativo.txt',
    ])
    expect(files).toEqual([
      { toplevel: outro, rel: 'x.ts', status: 'untracked' },
      { toplevel: repo, rel: 'a.txt', status: 'modified' },
      { toplevel: repo, rel: 'nova/c.md', status: 'untracked' },
      { toplevel: repo, rel: 'src/b.ts', status: 'deleted' },
    ])

    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'agente')
    await expect(svc.pendingFiles([p('a.txt'), p('nova', 'c.md')])).resolves.toEqual([])
  })

  it('defaultBase usa a branch de onde a atual foi criada, senão main', async () => {
    git(repo, 'branch', 'dev')
    const fromDev = path.join(base, 'wt-dev')
    git(repo, 'worktree', 'add', '-q', '-b', 'TECH-1-x', fromDev, 'dev')
    await expect(svc.defaultBase(fromDev)).resolves.toBe('dev')
    // Criada a partir de um commit (HEAD): não dá para saber; cai na main.
    const fromHead = path.join(base, 'wt-head')
    git(repo, 'worktree', 'add', '-q', '-b', 'TECH-2-x', fromHead, 'HEAD')
    await expect(svc.defaultBase(fromHead)).resolves.toBe('main')
  })

  it('defaultBase sem main nem master usa a branch aberta no repositório principal', async () => {
    git(repo, 'branch', '-m', 'main', 'dev')
    const wt = path.join(base, 'wt-x')
    git(repo, 'worktree', 'add', '-q', '-b', 'TECH-3-x', wt, 'HEAD')
    await expect(svc.defaultBase(wt)).resolves.toBe('dev')
  })

  it('gitDirs de uma worktree inclui o diretório comum', async () => {
    const { path: wt } = await svc.addWorktree(repo, 'feat/z', true)
    await guard.addRoot(wt)
    const dirs = await svc.gitDirs(wt)
    expect(dirs).toContain(path.join(repo, '.git'))
    expect(dirs.some((d) => d.includes(path.join('.git', 'worktrees')))).toBe(true)
  })
})
