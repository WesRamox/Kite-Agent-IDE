import type { AgentSession, Task } from '@shared/types'

// Caminho para comparar com o que veio do agente (barras e caixa do Windows, Git Bash): sem barra
// no fim, só "/", minúsculas.
function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

// No Windows o cwd e os arquivos do hook chegam com '\'; comparar com `${dir}/` só acertava o
// caminho idêntico ao da worktree.
function inside(dir: string, target: string): boolean {
  const d = norm(dir)
  const t = norm(target)
  return t === d || t.startsWith(`${d}/`)
}

function dirsOf(task: Task): string[] {
  return [...(task.folder ? [task.folder] : []), ...task.worktrees.map((w) => w.path)]
}

// Tarefa de cada sessão: vínculo manual; senão o cwd dentro da tarefa; senão a tarefa da última
// worktree que a sessão criou (a skill que monta a tarefa); senão a tarefa onde ficam a maioria
// dos arquivos editados (sessão aberta na raiz do workspace).
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
    const byCreated = createdTask(s, tasks)
    if (byCreated) {
      links.set(s.id, byCreated.id)
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

function createdTask(s: AgentSession, tasks: Task[]): Task | undefined {
  for (const dir of s.createdWorktrees) {
    const d = norm(dir)
    const task = tasks.find((t) => t.worktrees.some((w) => norm(w.path) === d))
    if (task) return task
  }
  return undefined
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
