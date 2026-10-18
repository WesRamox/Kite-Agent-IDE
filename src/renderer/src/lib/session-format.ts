import type { AgentSession, AgentTask } from '@shared/types'
import { t } from './i18n'

export type SessionTone = 'waiting' | 'running' | 'muted'

export function sessionTone(s: AgentSession): SessionTone {
  if (s.status === 'waiting') return 'waiting'
  if (s.status === 'running') return 'running'
  return 'muted'
}

export function sessionStatusLabel(s: AgentSession): string {
  if (s.status === 'waiting') {
    if (s.waitReason === 'permission') return t('agents.session.permission')
    if (s.waitReason === 'input') return t('agents.session.input')
    return t('agents.session.turn')
  }
  if (s.status === 'running') return t('agents.session.running')
  if (s.status === 'idle') return t('agents.session.idle')
  return t('agents.session.ended')
}

// Pasta pessoal abreviada como ~ (Linux, macOS e Windows).
export function tildePath(p: string): string {
  return p.replace(/^(\/home\/[^/]+|\/Users\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(?=$|[/\\])/, '~')
}

function relativeTo(file: string, dir: string): string {
  const base = dir.endsWith('/') || dir.endsWith('\\') ? dir : `${dir}/`
  return file.startsWith(base) ? file.slice(base.length) : tildePath(file)
}

// O que o Kite sabe do trabalho da sessão: arquivos editados ou o primeiro pedido.
export function sessionEvidence(s: AgentSession): string {
  const [last] = s.touchedPaths
  if (last) {
    return t('agents.session.edited', { file: relativeTo(last, s.cwd), more: s.touchedCount - 1 })
  }
  return t('agents.session.untouched', { prompt: s.firstPrompt ?? null })
}

// Agentes "esperando você": sessões dos hooks mais agentes do Kite, sem contar duas vezes a
// sessão de um agente aberto pelo Kite.
export function waitingCount(sessions: AgentSession[], tasks: AgentTask[]): number {
  const live = new Set(tasks.filter((t) => t.alive).map((t) => t.id))
  const external = sessions.filter(
    (s) => s.status === 'waiting' && !(s.agentTaskId && live.has(s.agentTaskId)),
  ).length
  return external + tasks.filter((t) => t.alive && t.status === 'waiting').length
}
