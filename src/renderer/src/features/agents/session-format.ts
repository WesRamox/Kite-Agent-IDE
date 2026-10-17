import type { AgentSession, AgentTask } from '@shared/types'

export type SessionTone = 'waiting' | 'running' | 'muted'

export function sessionTone(s: AgentSession): SessionTone {
  if (s.status === 'waiting') return 'waiting'
  if (s.status === 'running') return 'running'
  return 'muted'
}

export function sessionStatusLabel(s: AgentSession): string {
  if (s.status === 'waiting') {
    if (s.waitReason === 'permission') return 'pede permissão'
    if (s.waitReason === 'input') return 'precisa de resposta'
    return 'sua vez'
  }
  if (s.status === 'running') return 'trabalhando'
  if (s.status === 'idle') return 'aguardando o primeiro pedido'
  return 'encerrada'
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
    const more = s.touchedCount - 1
    const tail = more <= 0 ? '' : more === 1 ? ' e mais 1 arquivo' : ` e mais ${more} arquivos`
    return `Editou ${relativeTo(last, s.cwd)}${tail}.`
  }
  const prompt = s.firstPrompt ? ` Primeiro pedido: “${s.firstPrompt}”.` : ''
  return `Ainda não tocou em nenhuma worktree.${prompt}`
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
