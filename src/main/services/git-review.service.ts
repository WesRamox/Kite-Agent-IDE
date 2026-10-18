import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { GitChangeKind, GitDiff } from '@shared/types'
import { AppException } from '../lib/errors'
import { MAX_EDITABLE_BYTES } from '../lib/file-content'
import { execGit, showOrEmpty, type GitRunner } from '../lib/git-exec'
import { t } from '../lib/i18n'
import { isInside } from '../lib/workspace-guard'

export interface GitReviewServiceDeps {
  run: GitRunner
}

// Revisão de worktrees de agentes e tarefas: comparação com a branch base. Estes métodos recebem
// caminhos de worktrees que o próprio main descobriu ou criou; não passam pelo guard e não são
// expostos diretamente ao renderer.
export class GitReviewService {
  constructor(private readonly deps: GitReviewServiceDeps) {}

  // Arquivos alterados na worktree desde o merge-base com `base`: commitados, não commitados e
  // novos (não rastreados).
  async changesSince(
    worktree: string,
    base: string,
  ): Promise<{ mergeBase: string; files: { path: string; status: GitChangeKind }[] }> {
    const mergeBase = (await this.git(worktree, ['merge-base', base, 'HEAD'])).trim()
    if (!mergeBase) throw new AppException('GIT_ERROR', t('error.noCommonAncestor', { base }))
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

  // Branch base provável: a branch de onde a atual foi criada (o reflog guarda "branch: Created
  // from dev"), senão a padrão do origin (origin/HEAD), main ou master locais e, por fim, a branch
  // aberta no repositório principal.
  async defaultBase(worktree: string): Promise<string | null> {
    const created = await this.createdFrom(worktree)
    if (created) return created
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
    // Por último, a branch aberta no repositório principal (ex.: dev), se não for a própria.
    const list = await this.git(worktree, ['worktree', 'list', '--porcelain']).catch(() => '')
    const main = /^branch refs\/heads\/(.+)$/m.exec(list.split('\n\n')[0] ?? '')?.[1]
    const current = await this.git(worktree, ['symbolic-ref', '-q', '--short', 'HEAD'])
      .then((o) => o.trim())
      .catch(() => '')
    return main && main !== current ? main : null
  }

  private async createdFrom(worktree: string): Promise<string | null> {
    const branch = await this.git(worktree, ['symbolic-ref', '-q', '--short', 'HEAD'])
      .then((o) => o.trim())
      .catch(() => '')
    if (!branch) return null
    const log = await this.git(worktree, [
      'reflog',
      'show',
      '--format=%gs',
      `refs/heads/${branch}`,
      '--',
    ]).catch(() => '')
    const first = log.trim().split('\n').pop() ?? ''
    const from = /^branch: Created from (.+)$/
      .exec(first)?.[1]
      ?.replace(/^refs\/(heads|remotes)\//, '')
    // "HEAD" ou um hash não dizem qual é a base; só um nome de branch que ainda existe.
    if (!from || from === 'HEAD' || from === branch || /^[0-9a-f]{7,40}$/.test(from)) return null
    const exists = await this.git(worktree, ['rev-parse', '--verify', '-q', `${from}^{commit}`])
      .then((o) => o.trim() !== '')
      .catch(() => false)
    return exists ? from : null
  }

  async diffSince(worktree: string, mergeBase: string, rel: string): Promise<GitDiff> {
    const normalized = path.posix.normalize(rel)
    if (path.isAbsolute(rel) || normalized.startsWith('..') || rel.includes('\0')) {
      throw new AppException('FORBIDDEN_PATH', t('error.invalidPath'))
    }
    const original = await showOrEmpty(this.deps.run, worktree, `${mergeBase}:${normalized}`)
    const full = path.join(worktree, ...normalized.split('/'))
    let modified = ''
    try {
      const info = await stat(full)
      if (info.size > MAX_EDITABLE_BYTES)
        throw new AppException('FILE_TOO_LARGE', t('error.fileTooLarge'))
      modified = await readFile(full, 'utf8')
    } catch (err) {
      if (err instanceof AppException) throw err
    }
    const binary = original.includes('\0') || modified.includes('\0')
    return binary ? { original: '', modified: '', binary } : { original, modified, binary }
  }

  // Dos arquivos dados (absolutos), os que ainda têm alterações não commitadas, com o repositório
  // de cada um. Arquivos fora de um repositório ficam de fora. Usado para saber o que um agente
  // externo deixou para revisar.
  async pendingFiles(
    files: string[],
  ): Promise<{ toplevel: string; rel: string; status: GitChangeKind }[]> {
    const byRepo = new Map<string, Map<string, string>>()
    const tops = new Map<string, string | null>()
    for (const file of files) {
      if (!path.isAbsolute(file)) continue
      const found = await this.locate(file, tops)
      if (!found) continue
      const rels = byRepo.get(found.toplevel) ?? new Map<string, string>()
      rels.set(found.rel, file)
      byRepo.set(found.toplevel, rels)
    }
    const result: { toplevel: string; rel: string; status: GitChangeKind }[] = []
    for (const [toplevel, rels] of byRepo) {
      const out = await this.git(toplevel, [
        'status',
        '--porcelain=v1',
        '-z',
        '--no-renames',
        '--untracked-files=all',
        '--',
        ...[...rels.keys()].map((r) => `:(literal)${r}`),
      ])
      for (const entry of out.split('\0').filter(Boolean)) {
        const code = entry.slice(0, 2)
        const rel = entry.slice(3)
        if (!rels.has(rel)) continue
        const status: GitChangeKind =
          code === '??'
            ? 'untracked'
            : code.includes('D')
              ? 'deleted'
              : code.includes('A')
                ? 'added'
                : 'modified'
        result.push({ toplevel, rel, status })
      }
    }
    return result.sort((a, b) => a.toplevel.localeCompare(b.toplevel) || a.rel.localeCompare(b.rel))
  }

  // Repositório e caminho relativo de um arquivo, mesmo que ele (ou a pasta dele) tenha sido
  // apagado: sobe até a primeira pasta que existe.
  private async locate(
    file: string,
    tops: Map<string, string | null>,
  ): Promise<{ toplevel: string; rel: string } | null> {
    let dir = path.dirname(path.resolve(file))
    let real: string | null
    for (;;) {
      real = await realpath(dir).catch(() => null)
      if (real) break
      const up = path.dirname(dir)
      if (up === dir) return null
      dir = up
    }
    if (!tops.has(real)) {
      const top = await this.git(real, ['rev-parse', '--show-toplevel'])
        .then((o) => o.trim())
        .catch(() => '')
      tops.set(real, top ? await realpath(top).catch(() => null) : null)
    }
    const toplevel = tops.get(real)
    if (!toplevel) return null
    const full = path.join(real, path.relative(dir, path.resolve(file)))
    if (!isInside(toplevel, full) || full === toplevel) return null
    return { toplevel, rel: path.relative(toplevel, full).split(path.sep).join('/') }
  }

  private git(cwd: string, args: string[]): Promise<string> {
    return execGit(this.deps.run, cwd, args)
  }
}
