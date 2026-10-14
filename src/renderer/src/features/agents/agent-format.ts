import type { AgentTask } from '@shared/types'

export type AgentDisplayState = AgentTask['status'] | 'interrupted'

export function displayState(task: AgentTask): AgentDisplayState {
  return task.interrupted ? 'interrupted' : task.status
}

export const STATE_LABEL: Record<AgentDisplayState, string> = {
  running: 'Trabalhando',
  waiting: 'Aguardando você',
  done: 'Concluído',
  error: 'Erro',
  interrupted: 'Interrompido',
}

export const STATE_DOT: Record<AgentDisplayState, string> = {
  running: 'bg-info animate-pulse',
  waiting: 'bg-warning',
  done: 'bg-success',
  error: 'bg-danger',
  interrupted: 'bg-fg-muted',
}

// Duração legível: 45s, 3m 12s, 1h 05m.
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}
