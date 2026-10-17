import path from 'node:path'
import type { TaskGrouping, TaskSource, TaskWorktree } from '@shared/types'

// Agrupa worktrees de vários repositórios em tarefas (Fase 8). Funções puras: recebem o que o
// git listou e os ajustes do usuário, devolvem as tarefas.

export interface RepoWorktrees {
  repo: string
  name: string
  // Worktrees que não são a principal do repositório.
  worktrees: { path: string; branch: string | null; head: string }[]
}

export interface TaskOverrides {
  // Nome dado pelo usuário, por id de tarefa.
  names: Record<string, string>
  // Worktree movida para outra tarefa (id existente ou manual).
  moves: Record<string, string>
  // Worktrees que o usuário mandou ignorar.
  ignored: string[]
  // Tarefas criadas à mão (ex.: "Criar tarefa" numa worktree solta).
  manual: { id: string; name: string }[]
  // Tarefas desmarcadas na descoberta.
  hidden: string[]
}

export const EMPTY_OVERRIDES: TaskOverrides = {
  names: {},
  moves: {},
  ignored: [],
  manual: [],
  hidden: [],
}

export interface GroupedTask {
  id: string
  key: string
  source: TaskSource
  why: string
  folder: string | null
  worktrees: TaskWorktree[]
}

// Prefixos comuns de branch que não fazem parte do nome da tarefa.
const BRANCH_PREFIX = /^(feat|feature|fix|bugfix|hotfix|chore|refactor|agent|task|wip)\//i

export function branchKey(branch: string): string {
  return branch.replace(BRANCH_PREFIX, '')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ".worktrees/{tarefa}/{repo}" → regex que captura a tarefa no caminho relativo (com '/').
export function patternRegex(pattern: string): RegExp | null {
  const clean = pattern
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
  if (!clean.includes('{tarefa}')) return null
  const parts = clean.split(/(\{tarefa\}|\{repo\})/)
  const body = parts
    .map((p) => (p === '{tarefa}' ? '([^/]+)' : p === '{repo}' ? '[^/]+' : escapeRegex(p)))
    .join('')
  return new RegExp(`^${body}$`)
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

export function groupWorktrees(
  root: string,
  repos: RepoWorktrees[],
  grouping: TaskGrouping,
  overrides: TaskOverrides,
): { tasks: GroupedTask[]; unassigned: TaskWorktree[] } {
  const ignored = new Set(overrides.ignored)
  const repoDirs = new Set(repos.map((r) => r.repo))
  const all: TaskWorktree[] = repos.flatMap((r) =>
    r.worktrees
      .filter((w) => !ignored.has(w.path))
      .map((w) => ({ repo: r.repo, repoName: r.name, ...w })),
  )
  const tasks = new Map<string, GroupedTask>()
  const placed = new Set<string>()
  const add = (id: string, init: Omit<GroupedTask, 'worktrees'>, wt: TaskWorktree) => {
    const task = tasks.get(id) ?? { ...init, worktrees: [] }
    task.worktrees.push(wt)
    tasks.set(id, task)
    placed.add(wt.path)
  }

  if (grouping.mode === 'auto') {
    // 1) Pasta da tarefa: worktrees de repositórios diferentes na mesma pasta
    //    (ex.: .worktrees/PAY-412/{api,web}). Uma pasta com várias worktrees do mesmo repo é
    //    uma pasta de worktrees daquele repo (ex.: api-worktrees/), não uma tarefa.
    const byParent = new Map<string, TaskWorktree[]>()
    for (const wt of all) {
      const parent = path.dirname(wt.path)
      byParent.set(parent, [...(byParent.get(parent) ?? []), wt])
    }
    for (const [parent, wts] of byParent) {
      if (parent === root || repoDirs.has(parent)) continue
      const distinct = new Set(wts.map((w) => w.repo)).size === wts.length
      const named = wts.every((w) => path.basename(w.path) === w.repoName)
      if (!distinct || !(wts.length >= 2 || named)) continue
      const key = path.basename(parent)
      for (const wt of wts) {
        add(
          `folder:${parent}`,
          { id: `folder:${parent}`, key, source: 'folder', why: '', folder: parent },
          wt,
        )
      }
    }
    // 2) Mesmo nome de branch (sem prefixos como feat/) em repositórios diferentes.
    const byBranch = new Map<string, TaskWorktree[]>()
    for (const wt of all) {
      if (placed.has(wt.path) || !wt.branch) continue
      const k = branchKey(wt.branch).toLowerCase()
      byBranch.set(k, [...(byBranch.get(k) ?? []), wt])
    }
    for (const [k, wts] of byBranch) {
      // Duas worktrees do mesmo repo com a mesma branch não existem; mesmo assim, uma por repo.
      const seen = new Set<string>()
      for (const wt of wts) {
        if (seen.has(wt.repo)) continue
        seen.add(wt.repo)
        const key = branchKey(wt.branch ?? k)
        add(`branch:${k}`, { id: `branch:${k}`, key, source: 'branch', why: '', folder: null }, wt)
      }
    }
  } else if (grouping.mode === 'pattern') {
    const re = patternRegex(grouping.pattern)
    for (const wt of re ? all : []) {
      const rel = path.isAbsolute(wt.path) ? toPosix(path.relative(root, wt.path)) : wt.path
      const m = re?.exec(rel)
      const key = m?.[1]
      if (!key) continue
      add(
        `pattern:${key.toLowerCase()}`,
        { id: `pattern:${key.toLowerCase()}`, key, source: 'pattern', why: '', folder: null },
        wt,
      )
    }
  }

  // Ajustes manuais: tarefas criadas à mão e worktrees movidas.
  for (const m of overrides.manual) {
    if (!tasks.has(m.id)) {
      tasks.set(m.id, {
        id: m.id,
        key: m.name,
        source: 'manual',
        why: 'montada por você',
        folder: null,
        worktrees: [],
      })
    }
  }
  for (const [wtPath, target] of Object.entries(overrides.moves)) {
    const wt = all.find((w) => w.path === wtPath)
    const dest = tasks.get(target)
    if (!wt || !dest) continue
    for (const t of tasks.values()) t.worktrees = t.worktrees.filter((w) => w.path !== wtPath)
    dest.worktrees.push(wt)
    placed.add(wtPath)
  }

  const result: GroupedTask[] = []
  for (const t of tasks.values()) {
    if (t.worktrees.length === 0 && t.source !== 'manual') continue
    t.worktrees.sort((a, b) => a.repoName.localeCompare(b.repoName))
    if (t.source !== 'manual') t.why = explain(t, root)
    result.push(t)
  }
  result.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  const assigned = new Set(result.flatMap((t) => t.worktrees.map((w) => w.path)))
  return { tasks: result, unassigned: all.filter((w) => !assigned.has(w.path)) }
}

function explain(t: GroupedTask, root: string): string {
  if (t.source === 'folder' && t.folder) {
    const rel = toPosix(path.relative(root, t.folder))
    return `mesma pasta ${rel.startsWith('..') ? t.folder : rel}`
  }
  if (t.source === 'branch') {
    return t.worktrees.length > 1 ? `mesma branch em ${t.worktrees.length} repos` : 'branch própria'
  }
  return 'segue o padrão de pasta'
}

// Título e link do card a partir de um arquivo de metadados na pasta da tarefa:
// .kite-task.json ({ "title", "url" }) ou TASK.md (primeiro título "# ..." e primeiro link).
export function parseTaskMeta(
  file: 'json' | 'md',
  content: string,
): { title: string | null; url: string | null } {
  if (file === 'json') {
    try {
      const data = JSON.parse(content) as { title?: unknown; url?: unknown }
      return {
        title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null,
        url: typeof data.url === 'string' && /^https?:\/\//.test(data.url) ? data.url : null,
      }
    } catch {
      return { title: null, url: null }
    }
  }
  const title = /^#\s+(.+)$/m.exec(content)?.[1]?.trim() ?? null
  const url = /https?:\/\/[^\s)>\]]+/.exec(content)?.[0] ?? null
  return { title, url }
}
