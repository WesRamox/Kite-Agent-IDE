import { branchKey } from '@shared/task-key'
import type { TaskWorktree, WorkspaceTasks } from '@shared/types'

// Worktrees soltas da mesma branch em repositórios diferentes: candidatas a uma tarefa só.
export interface LooseGroup {
  key: string
  worktrees: TaskWorktree[]
}

// Separa as soltas em grupos sugeridos (mesma branch, sem prefixos como feat/, em 2+ repos) e as
// que ficam sozinhas. É a mesma regra do agrupamento automático, para quem usa padrão ou manual.
export function groupLoose(wts: TaskWorktree[]): {
  groups: LooseGroup[]
  single: TaskWorktree[]
} {
  const byKey = new Map<string, TaskWorktree[]>()
  for (const w of wts) {
    if (!w.branch) continue
    const k = branchKey(w.branch).toLowerCase()
    byKey.set(k, [...(byKey.get(k) ?? []), w])
  }
  const groups: LooseGroup[] = []
  const grouped = new Set<string>()
  for (const list of byKey.values()) {
    // Uma por repositório: duas do mesmo repo não formam uma tarefa multi-repo.
    const seen = new Set<string>()
    const members = list.filter((w) => !seen.has(w.repo) && seen.add(w.repo))
    if (members.length < 2) continue
    members.sort((a, b) => a.repoName.localeCompare(b.repoName))
    members.forEach((w) => grouped.add(w.path))
    groups.push({ key: branchKey(members[0]?.branch ?? ''), worktrees: members })
  }
  groups.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  return { groups, single: wts.filter((w) => !grouped.has(w.path)) }
}

// O padrão de pasta não encontrou nenhuma worktree, mas há worktrees soltas: o layout real é
// outro (ex.: <repo>/.worktrees/<tarefa>), e o automático as agruparia.
export function patternMisses(ws: WorkspaceTasks): boolean {
  return (
    ws.grouping.mode === 'pattern' &&
    ws.unassigned.length > 0 &&
    !ws.tasks.some((t) => t.source === 'pattern')
  )
}
