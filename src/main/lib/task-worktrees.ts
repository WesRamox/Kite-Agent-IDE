import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { AppException } from './errors'
import type { GitRunner } from './git-exec'
import { parseWorktrees } from './git-parse'
import { normalizePattern, parseTaskMeta, type RepoWorktrees, type TaskMeta } from './task-grouping'

export function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  )
}

// Branch mais comum entre as worktrees da tarefa.
export function commonBranch(worktrees: { branch: string | null }[]): string | null {
  const counts = new Map<string, number>()
  for (const w of worktrees) if (w.branch) counts.set(w.branch, (counts.get(w.branch) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// Worktrees secundárias de um repositório (sem a principal e sem as que o git marcou como
// prunable), com caminhos reais. Repositório inacessível: lista vazia.
export async function listTaskWorktrees(
  run: GitRunner,
  repo: string,
): Promise<RepoWorktrees['worktrees']> {
  let out: string
  try {
    out = await run(repo, ['worktree', 'list', '--porcelain'])
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

// Cria a worktree em `dir`, reaproveitando a branch se ela já existe. `label` prefixa a
// mensagem de erro (nome do repo quando são vários).
export async function addWorktree(
  run: GitRunner,
  repo: string,
  branch: string,
  dir: string,
  label?: string,
): Promise<void> {
  // `rev-parse --verify -q` falha em silêncio: a saída vazia é que indica "não existe".
  const hasBranch = await run(repo, [
    'rev-parse',
    '--verify',
    '-q',
    `refs/heads/${branch}^{commit}`,
  ]).then(
    (out) => out.trim() !== '',
    () => false,
  )
  try {
    await run(
      repo,
      hasBranch ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir, 'HEAD'],
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new AppException('GIT_ERROR', label ? `${label}: ${message}` : message)
  }
}

// Pasta da worktree de `repoName` numa tarefa nova: o padrão do workspace
// (.worktrees/{tarefa}/{repo}) ou, quando a pasta aberta é o próprio repositório,
// ../<repo>-worktrees/<tarefa>.
export function newTaskWorktreeDir(opts: {
  root: string
  single: boolean
  pattern: string
  key: string
  repoName: string
}): string {
  if (opts.single) return path.join(path.dirname(opts.root), `${opts.repoName}-worktrees`, opts.key)
  return path.resolve(
    opts.root,
    normalizePattern(opts.pattern)
      .replaceAll('{tarefa}', opts.key)
      .replaceAll('{repo}', opts.repoName),
  )
}

const META_FILES: [string, 'json' | 'md'][] = [
  ['.kite-task.json', 'json'],
  ['TASK.md', 'md'],
]

// Título (e resumo) da tarefa no primeiro .kite-task.json ou TASK.md encontrado nas pastas dadas.
export async function readTaskMeta(dirs: (string | null)[]): Promise<TaskMeta> {
  for (const dir of dirs) {
    if (!dir) continue
    for (const [name, kind] of META_FILES) {
      const content = await readFile(path.join(dir, name), 'utf8').catch(() => null)
      if (content === null || content.length > 200_000) continue
      const meta = parseTaskMeta(kind, content)
      if (meta.title) return meta
    }
  }
  return { title: null, summary: [], rule: [] }
}
