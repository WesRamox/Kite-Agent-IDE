import type { Task, WorkspaceTasks } from '@shared/types'

// Tarefas novas (esperando na descoberta) ainda não avisadas. Conta como avisada a tarefa com
// alguma worktree já avisada: o id muda quando a heurística reagrupa (a skill cria a segunda
// worktree e a tarefa passa de "branch" para "pasta"), e o aviso não deve se repetir.
export function unannounced(ws: WorkspaceTasks, announced: ReadonlySet<string>): Task[] {
  if (!ws.imported) return []
  return ws.tasks.filter((t) => t.pending && t.worktrees.every((w) => !announced.has(w.path)))
}

// A tarefa nova que hoje contém a worktree (o agrupamento pode ter mudado desde o aviso).
export function pendingTaskWith(ws: WorkspaceTasks | null, worktree: string): Task | null {
  return ws?.tasks.find((t) => t.pending && t.worktrees.some((w) => w.path === worktree)) ?? null
}
