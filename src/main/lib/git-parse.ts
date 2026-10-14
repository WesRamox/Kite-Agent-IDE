import type { GitBranch, GitChangeKind, GitFileChange, GitWorktree } from '@shared/types'

const KIND: Record<string, GitChangeKind> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'typechange',
}

function kindOf(code: string | undefined): GitChangeKind | null {
  return code && code !== '.' ? (KIND[code] ?? 'modified') : null
}

export interface ParsedStatus {
  head: string | null
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  // Caminhos relativos à raiz do repositório, com '/'.
  files: (Omit<GitFileChange, 'path' | 'origPath'> & { rel: string; origRel?: string })[]
}

// Interpreta `git status --porcelain=v2 --branch -z`.
export function parseStatusV2(output: string): ParsedStatus {
  const result: ParsedStatus = {
    head: null,
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    files: [],
  }
  const fields = output.split('\0')
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i] ?? ''
    if (entry === '') continue
    if (entry.startsWith('# ')) {
      const [, key, ...rest] = entry.split(' ')
      const value = rest.join(' ')
      if (key === 'branch.oid') result.head = value === '(initial)' ? null : value.slice(0, 7)
      else if (key === 'branch.head') result.branch = value === '(detached)' ? null : value
      else if (key === 'branch.upstream') result.upstream = value
      else if (key === 'branch.ab') {
        const m = /^\+(\d+) -(\d+)$/.exec(value)
        if (m) {
          result.ahead = Number(m[1])
          result.behind = Number(m[2])
        }
      }
      continue
    }
    const type = entry[0]
    if (type === '?') {
      result.files.push({ rel: entry.slice(2), staged: null, unstaged: 'untracked' })
    } else if (type === '1') {
      // 1 XY sub mH mI mW hH hI path
      const parts = entry.split(' ')
      const xy = parts[1] ?? '..'
      result.files.push({
        rel: parts.slice(8).join(' '),
        staged: kindOf(xy[0]),
        unstaged: kindOf(xy[1]),
      })
    } else if (type === '2') {
      // 2 XY sub mH mI mW hH hI Xscore path \0 origPath
      const parts = entry.split(' ')
      const xy = parts[1] ?? '..'
      result.files.push({
        rel: parts.slice(9).join(' '),
        origRel: fields[++i],
        staged: kindOf(xy[0]),
        unstaged: kindOf(xy[1]),
      })
    } else if (type === 'u') {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path
      const parts = entry.split(' ')
      result.files.push({ rel: parts.slice(10).join(' '), staged: null, unstaged: 'conflicted' })
    }
  }
  return result
}

// Interpreta `git for-each-ref --format=<name>%00<HEAD>%00<upstream>%00<worktreepath>`.
export function parseBranches(output: string): GitBranch[] {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [name = '', head = '', upstream = '', worktree = ''] = line.split('\0')
      return {
        name,
        current: head === '*',
        upstream: upstream || null,
        worktreePath: worktree || null,
      }
    })
}

// Interpreta `git worktree list --porcelain`.
export function parseWorktrees(output: string, currentPath: string): GitWorktree[] {
  const blocks = output.split(/\n\n+/).filter((b) => b.trim() !== '')
  return blocks.map((block, index) => {
    const wt: GitWorktree = {
      path: '',
      branch: null,
      head: '',
      isMain: index === 0,
      isCurrent: false,
      locked: false,
      prunable: false,
    }
    for (const line of block.split('\n')) {
      const space = line.indexOf(' ')
      const key = space === -1 ? line : line.slice(0, space)
      const value = space === -1 ? '' : line.slice(space + 1)
      if (key === 'worktree') wt.path = value
      else if (key === 'HEAD') wt.head = value.slice(0, 7)
      else if (key === 'branch') wt.branch = value.replace(/^refs\/heads\//, '')
      else if (key === 'locked') wt.locked = true
      else if (key === 'prunable') wt.prunable = true
    }
    wt.isCurrent = wt.path === currentPath
    return wt
  })
}

// Pasta padrão para novas worktrees: ../<repo>-worktrees/<branch> (com '/' trocado por '-').
export function worktreeDirName(branch: string): string {
  return branch.replace(/[\\/]+/g, '-').replace(/^\.+/, '')
}
