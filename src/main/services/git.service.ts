import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { GitBranch, GitChangeKind, GitDiff, GitStatus, GitWorktree } from '@shared/types'
import { AppException } from '../lib/errors'
import { MAX_EDITABLE_BYTES } from '../lib/file-content'
import { parseBranches, parseStatusV2, parseWorktrees, worktreeDirName } from '../lib/git-parse'
import { isInside, type WorkspaceGuard } from '../lib/workspace-guard'

// Executa `git <args>` em `cwd` e devolve o stdout. Falhas viram exceção com a mensagem do git.
// `env` extra é usado para autenticação (nunca vai para a linha de comando).
export type GitRunner = (
  cwd: string,
  args: string[],
  env?: Record<string, string>,
) => Promise<string>

export interface GitServiceDeps {
  guard: WorkspaceGuard
  run: GitRunner
}

interface Repo {
  root: string
  toplevel: string
}

export class GitService {
  constructor(private readonly deps: GitServiceDeps) {}

  async status(root: string): Promise<GitStatus> {
    let repo: Repo
    try {
      repo = await this.repo(root)
    } catch (err) {
      if (err instanceof AppException && err.code === 'NOT_A_REPO') return { isRepo: false }
      throw err
    }
    const spec = this.pathspec(repo)
    const [out, worktrees] = await Promise.all([
      this.git(repo.toplevel, [
        'status',
        '--porcelain=v2',
        '--branch',
        '-z',
        '--untracked-files=all',
        '--',
        spec,
      ]),
      this.worktrees(root),
    ])
    const parsed = parseStatusV2(out)
    return {
      isRepo: true,
      branch: parsed.branch,
      head: parsed.head,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      files: parsed.files.map(({ rel, origRel, staged, unstaged }) => ({
        path: this.abs(repo, rel),
        ...(origRel ? { origPath: this.abs(repo, origRel) } : {}),
        staged,
        unstaged,
      })),
      worktreePath: repo.toplevel,
      isMainWorktree: worktrees.find((w) => w.isCurrent)?.isMain ?? true,
    }
  }

  // Conteúdo "antes" e "depois" para o diff editor.
  // staged: HEAD × index. Não staged: index × arquivo no disco.
  async diff(root: string, file: string, staged: boolean): Promise<GitDiff> {
    const repo = await this.repo(root)
    const rel = this.rel(repo, file)
    const original = staged
      ? await this.showOrEmpty(repo, `HEAD:${rel}`)
      : await this.showOrEmpty(repo, `:${rel}`)
    const modified = staged ? await this.showOrEmpty(repo, `:${rel}`) : await this.readWorking(file)
    const binary = original.includes('\0') || modified.includes('\0')
    return binary ? { original: '', modified: '', binary } : { original, modified, binary }
  }

  async stage(root: string, files: string[]): Promise<void> {
    const repo = await this.repo(root)
    const rels = files.map((f) => this.rel(repo, f))
    if (rels.length > 0) await this.git(repo.toplevel, ['add', '-A', '--', ...rels])
  }

  async unstage(root: string, files: string[]): Promise<void> {
    const repo = await this.repo(root)
    const rels = files.map((f) => this.rel(repo, f))
    if (rels.length === 0) return
    if (await this.hasHead(repo)) {
      await this.git(repo.toplevel, ['reset', '-q', 'HEAD', '--', ...rels])
    } else {
      // Repositório sem commits: não há HEAD para voltar, só tira do index.
      await this.git(repo.toplevel, ['rm', '-r', '-q', '--cached', '--', ...rels])
    }
  }

  async commit(root: string, message: string): Promise<{ hash: string }> {
    const repo = await this.repo(root)
    if (message.trim() === '') throw new AppException('INVALID_ARGS', 'Mensagem de commit vazia')
    const status = await this.status(root)
    if (status.isRepo && !status.files.some((f) => f.staged)) {
      throw new AppException('GIT_ERROR', 'Nada no stage para commitar')
    }
    await this.git(repo.toplevel, ['commit', '-q', '-m', message])
    const hash = (await this.git(repo.toplevel, ['rev-parse', '--short', 'HEAD'])).trim()
    return { hash }
  }

  async branches(root: string): Promise<GitBranch[]> {
    const repo = await this.repo(root)
    const out = await this.git(repo.toplevel, [
      'for-each-ref',
      '--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(worktreepath)',
      'refs/heads',
    ])
    return parseBranches(out)
  }

  async checkout(root: string, branch: string, create: boolean): Promise<void> {
    const repo = await this.repo(root)
    await this.validateBranchName(repo, branch)
    await this.git(repo.toplevel, create ? ['switch', '-c', branch] : ['switch', branch])
  }

  async worktrees(root: string): Promise<GitWorktree[]> {
    const repo = await this.repo(root)
    const out = await this.git(repo.toplevel, ['worktree', 'list', '--porcelain'])
    const list = parseWorktrees(out, repo.toplevel)
    // Normaliza caminhos (o git pode devolver caminhos com symlinks).
    return Promise.all(
      list.map(async (w) => {
        const real = await realpath(w.path).catch(() => w.path)
        return { ...w, path: real, isCurrent: real === repo.toplevel }
      }),
    )
  }

  // Cria uma worktree em ../<repo>-worktrees/<branch>. O caminho é decidido aqui, não no renderer.
  async addWorktree(
    root: string,
    branch: string,
    createBranch: boolean,
  ): Promise<{ path: string }> {
    const repo = await this.repo(root)
    await this.validateBranchName(repo, branch)
    const main = (await this.worktrees(root)).find((w) => w.isMain)
    if (!main) throw new AppException('GIT_ERROR', 'Worktree principal não encontrada')
    const dir = path.join(
      path.dirname(main.path),
      `${path.basename(main.path)}-worktrees`,
      worktreeDirName(branch),
    )
    if (
      await stat(dir).then(
        () => true,
        () => false,
      )
    ) {
      throw new AppException('ALREADY_EXISTS', `A pasta ${dir} já existe`)
    }
    const args = createBranch
      ? ['worktree', 'add', '-b', branch, dir, 'HEAD']
      : ['worktree', 'add', dir, branch]
    await this.git(repo.toplevel, args)
    return { path: await realpath(dir) }
  }

  async removeWorktree(root: string, target: string, force: boolean): Promise<void> {
    const repo = await this.repo(root)
    const wt = (await this.worktrees(root)).find((w) => w.path === target)
    if (!wt) throw new AppException('NOT_FOUND', 'Worktree não encontrada')
    if (wt.isMain)
      throw new AppException('FORBIDDEN_PATH', 'A worktree principal não pode ser removida')
    if (wt.isCurrent)
      throw new AppException('FORBIDDEN_PATH', 'Não é possível remover a worktree aberta')
    await this.git(repo.toplevel, ['worktree', 'remove', ...(force ? ['--force'] : []), wt.path])
  }

  async isWorktreeOf(root: string, target: string): Promise<boolean> {
    return (await this.worktrees(root)).some((w) => w.path === target)
  }

  async remoteUrl(root: string, remote = 'origin'): Promise<string | null> {
    const repo = await this.repo(root)
    try {
      // URL configurada, sem reescritas de `url.*.insteadOf` (o host real do remote).
      return (
        (await this.git(repo.toplevel, ['config', '--get', `remote.${remote}.url`])).trim() || null
      )
    } catch {
      return null
    }
  }

  async branchExists(root: string, branch: string): Promise<boolean> {
    const repo = await this.repo(root)
    await this.validateBranchName(repo, branch)
    return this.revExists(repo, `refs/heads/${branch}`)
  }

  // Envia a branch para o origin e passa a segui-la (upstream).
  async push(root: string, branch: string, env?: Record<string, string>): Promise<void> {
    const repo = await this.repo(root)
    await this.validateBranchName(repo, branch)
    await this.git(
      repo.toplevel,
      ['push', '-u', 'origin', `refs/heads/${branch}:refs/heads/${branch}`],
      env,
    )
  }

  // Baixa a cabeça de um PR (refs/pull/N/head funciona também para PRs de forks) numa branch
  // local.
  async fetchPullRef(
    root: string,
    pull: number,
    localBranch: string,
    env?: Record<string, string>,
  ): Promise<void> {
    const repo = await this.repo(root)
    if (!Number.isInteger(pull) || pull <= 0) throw new AppException('INVALID_ARGS', 'PR inválido')
    await this.validateBranchName(repo, localBranch)
    await this.git(
      repo.toplevel,
      ['fetch', 'origin', `+refs/pull/${pull}/head:refs/heads/${localBranch}`],
      env,
    )
  }

  // --- Revisão de worktrees de agentes ---
  // Estes métodos recebem caminhos de worktrees criadas pelo próprio app (o AgentService os
  // guarda); não passam pelo guard e não são expostos diretamente ao renderer.

  // Arquivos alterados na worktree desde o merge-base com `base`: commitados, não commitados e
  // novos (não rastreados).
  async changesSince(
    worktree: string,
    base: string,
  ): Promise<{ mergeBase: string; files: { path: string; status: GitChangeKind }[] }> {
    const mergeBase = (await this.git(worktree, ['merge-base', base, 'HEAD'])).trim()
    if (!mergeBase) throw new AppException('GIT_ERROR', `Sem ancestral comum com ${base}`)
    const diff = await this.git(worktree, [
      'diff',
      '--name-status',
      '-z',
      '--no-renames',
      mergeBase,
    ])
    const untracked = await this.git(worktree, ['ls-files', '--others', '--exclude-standard', '-z'])
    const files = new Map<string, GitChangeKind>()
    const parts = diff.split('\0').filter(Boolean)
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const code = parts[i] ?? ''
      files.set(parts[i + 1] ?? '', code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified')
    }
    for (const rel of untracked.split('\0').filter(Boolean)) files.set(rel, 'untracked')
    return {
      mergeBase,
      files: [...files]
        .map(([p, status]) => ({ path: p, status }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    }
  }

  // Remove a worktree de uma tarefa de agente (mesmo com alterações), a partir do repositório
  // principal.
  async removeWorktreeAt(repoPath: string, worktree: string): Promise<void> {
    await this.git(repoPath, ['worktree', 'remove', '--force', worktree])
  }

  // Conteúdo no merge-base × arquivo atual na worktree.
  // Linhas adicionadas/removidas por arquivo desde o merge-base (inclui o que não foi
  // commitado). Arquivos novos não rastreados contam as linhas do arquivo inteiro.
  async numstatSince(
    worktree: string,
    mergeBase: string,
    untracked: string[],
  ): Promise<Map<string, { added: number | null; deleted: number | null }>> {
    const out = await this.git(worktree, ['diff', '--numstat', '-z', '--no-renames', mergeBase])
    const stats = new Map<string, { added: number | null; deleted: number | null }>()
    for (const entry of out.split('\0').filter(Boolean)) {
      const [a, d, ...rest] = entry.split('\t')
      const rel = rest.join('\t')
      if (!rel) continue
      stats.set(rel, {
        added: a === '-' ? null : Number(a),
        deleted: d === '-' ? null : Number(d),
      })
    }
    for (const rel of untracked) {
      const content = await readFile(path.join(worktree, ...rel.split('/'))).catch(() => null)
      if (!content || content.length > MAX_EDITABLE_BYTES || content.includes(0)) {
        stats.set(rel, { added: null, deleted: null })
        continue
      }
      const text = content.toString('utf8')
      const lines = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
      stats.set(rel, { added: lines, deleted: 0 })
    }
    return stats
  }

  // Commits na branch desde o merge-base.
  async commitsSince(worktree: string, mergeBase: string): Promise<number> {
    const out = await this.git(worktree, ['rev-list', '--count', `${mergeBase}..HEAD`])
    return Number(out.trim()) || 0
  }

  // Branch base provável: a padrão do origin (origin/HEAD), senão main ou master locais.
  async defaultBase(worktree: string): Promise<string | null> {
    const head = await this.git(worktree, [
      'symbolic-ref',
      '-q',
      '--short',
      'refs/remotes/origin/HEAD',
    ])
      .then((o) => o.trim())
      .catch(() => '')
    if (head.startsWith('origin/')) return head.slice('origin/'.length)
    for (const name of ['main', 'master']) {
      const out = await this.git(worktree, [
        'rev-parse',
        '--verify',
        '-q',
        `refs/heads/${name}^{commit}`,
      ])
        .then((o) => o.trim())
        .catch(() => '')
      if (out) return name
    }
    return null
  }

  // Commita tudo o que mudou na pasta aberta (git add -A).
  async commitAll(root: string, message: string): Promise<{ hash: string }> {
    const repo = await this.repo(root)
    await this.git(repo.toplevel, ['add', '-A', '--', this.pathspec(repo)])
    return this.commit(root, message)
  }

  async diffSince(worktree: string, mergeBase: string, rel: string): Promise<GitDiff> {
    const normalized = path.posix.normalize(rel)
    if (path.isAbsolute(rel) || normalized.startsWith('..') || rel.includes('\0')) {
      throw new AppException('FORBIDDEN_PATH', 'Caminho inválido')
    }
    const repo: Repo = { root: worktree, toplevel: worktree }
    const original = await this.showOrEmpty(repo, `${mergeBase}:${normalized}`)
    const full = path.join(worktree, ...normalized.split('/'))
    let modified = ''
    try {
      const info = await stat(full)
      if (info.size > MAX_EDITABLE_BYTES)
        throw new AppException('FILE_TOO_LARGE', 'Arquivo maior que 5 MB')
      modified = await readFile(full, 'utf8')
    } catch (err) {
      if (err instanceof AppException) throw err
    }
    const binary = original.includes('\0') || modified.includes('\0')
    return binary ? { original: '', modified: '', binary } : { original, modified, binary }
  }

  // Diretórios internos do git a observar (HEAD, index, refs). Numa worktree, o gitdir fica
  // dentro do diretório comum do repositório principal.
  async gitDirs(root: string): Promise<string[]> {
    const repo = await this.repo(root)
    const out = await this.git(repo.toplevel, [
      'rev-parse',
      '--absolute-git-dir',
      '--git-common-dir',
    ])
    const [gitDir = '', common = ''] = out.trim().split('\n')
    const dirs = [gitDir, path.resolve(repo.toplevel, common)]
    return [...new Set(dirs.filter(Boolean))]
  }

  private async repo(root: string): Promise<Repo> {
    if (!this.deps.guard.isRoot(root)) {
      throw new AppException('FORBIDDEN_PATH', 'Não é uma pasta aberta')
    }
    let top: string
    try {
      top = (await this.git(root, ['rev-parse', '--show-toplevel'])).trim()
    } catch {
      throw new AppException('NOT_A_REPO', 'A pasta não é um repositório Git')
    }
    return { root, toplevel: await realpath(top) }
  }

  // Restringe o status à pasta aberta quando ela é uma subpasta do repositório.
  private pathspec(repo: Repo): string {
    const rel = path.relative(repo.toplevel, repo.root)
    return rel === '' ? '.' : rel.split(path.sep).join('/')
  }

  private abs(repo: Repo, rel: string): string {
    return path.join(repo.toplevel, ...rel.split('/'))
  }

  // Caminho relativo à raiz do repositório (com '/'), exigindo que esteja na pasta aberta.
  private rel(repo: Repo, file: string): string {
    if (!path.isAbsolute(file)) throw new AppException('FORBIDDEN_PATH', 'Caminho inválido')
    const normalized = path.resolve(file)
    if (!isInside(repo.root, normalized) || !isInside(repo.toplevel, normalized)) {
      throw new AppException('FORBIDDEN_PATH', 'Caminho fora das pastas abertas')
    }
    const rel = path.relative(repo.toplevel, normalized)
    if (rel === '') throw new AppException('INVALID_ARGS', 'Caminho é a raiz do repositório')
    return rel.split(path.sep).join('/')
  }

  private async hasHead(repo: Repo): Promise<boolean> {
    return this.revExists(repo, 'HEAD')
  }

  // `rev-parse --verify -q` falha em silêncio (sem stderr), e o simple-git só rejeita quando há
  // stderr: por isso a checagem é pela saída, não pela exceção.
  private async revExists(repo: Repo, rev: string): Promise<boolean> {
    try {
      const out = await this.git(repo.toplevel, ['rev-parse', '--verify', '-q', `${rev}^{commit}`])
      return out.trim() !== ''
    } catch {
      return false
    }
  }

  private async showOrEmpty(repo: Repo, object: string): Promise<string> {
    let size: number
    try {
      size = Number((await this.git(repo.toplevel, ['cat-file', '-s', object])).trim())
    } catch {
      return '' // não existe nessa versão (novo, removido ou repositório sem commits)
    }
    if (size > MAX_EDITABLE_BYTES)
      throw new AppException('FILE_TOO_LARGE', 'Arquivo maior que 5 MB')
    return this.git(repo.toplevel, ['show', object])
  }

  private async readWorking(file: string): Promise<string> {
    try {
      const real = await this.deps.guard.resolveExisting(file)
      if ((await stat(real)).size > MAX_EDITABLE_BYTES) {
        throw new AppException('FILE_TOO_LARGE', 'Arquivo maior que 5 MB')
      }
      return await readFile(real, 'utf8')
    } catch (err) {
      if (err instanceof AppException && err.code !== 'NOT_FOUND') throw err
      return '' // removido no disco
    }
  }

  private async validateBranchName(repo: Repo, branch: string): Promise<void> {
    // Nada que comece com '-' (seria lido como opção) e nome aceito pelo próprio git.
    if (branch.startsWith('-') || branch.trim() !== branch || branch.length > 200) {
      throw new AppException('INVALID_ARGS', `Nome de branch inválido: ${branch}`)
    }
    try {
      await this.git(repo.toplevel, ['check-ref-format', '--branch', branch])
    } catch {
      throw new AppException('INVALID_ARGS', `Nome de branch inválido: ${branch}`)
    }
  }

  private async git(cwd: string, args: string[], env?: Record<string, string>): Promise<string> {
    try {
      return await this.deps.run(cwd, args, env)
    } catch (err) {
      if (err instanceof AppException) throw err
      throw new AppException('GIT_ERROR', cleanGitMessage(err))
    }
  }
}

// Mensagem do git, sem prefixos e com no máximo algumas linhas.
export function cleanGitMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^(fatal|error|hint): /, '').trim())
    .filter((l) => l !== '')
  return lines.slice(0, 3).join(' ') || 'Erro do git'
}
