import type { AgentSession, Task } from '@shared/types'

function inside(dir: string, target: string): boolean {
  const base = dir.endsWith('/') || dir.endsWith('\\') ? dir : `${dir}/`
  return target === dir || target.startsWith(base)
}

function dirsOf(task: Task): string[] {
  return [...(task.folder ? [task.folder] : []), ...task.worktrees.map((w) => w.path)]
}

// Tarefa de cada sessão: vínculo manual; senão o cwd dentro da tarefa; senão a tarefa onde
// ficam a maioria dos arquivos editados (sessão aberta na raiz do workspace).
export function linkSessions(
  sessions: AgentSession[],
  tasks: Task[],
  manual: Record<string, string>,
): Map<string, string> {
  const links = new Map<string, string>()
  const known = new Set(tasks.map((t) => t.id))
  for (const s of sessions) {
    const forced = manual[s.id]
    if (forced && known.has(forced)) {
      links.set(s.id, forced)
      continue
    }
    const byCwd = tasks.find((t) => dirsOf(t).some((d) => inside(d, s.cwd)))
    if (byCwd) {
      links.set(s.id, byCwd.id)
      continue
    }
    const votes = new Map<string, number>()
    for (const file of s.touchedPaths) {
      const t = tasks.find((x) => x.worktrees.some((w) => inside(w.path, file)))
      if (t) votes.set(t.id, (votes.get(t.id) ?? 0) + 1)
    }
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]
    if (best) links.set(s.id, best[0])
  }
  return links
}

// Arquivos editados pela sessão em cada worktree da tarefa (chips "api 3 alterados").
export function touchedByRepo(task: Task, sessions: AgentSession[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const w of task.worktrees) {
    const files = new Set<string>()
    for (const s of sessions) for (const f of s.touchedPaths) if (inside(w.path, f)) files.add(f)
    counts[w.repoName] = files.size
  }
  return counts
}
