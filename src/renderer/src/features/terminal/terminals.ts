import { TerminalSession, type SessionOptions } from './terminal-session'

// Sessões vivas por id de painel. Ficam fora do React: o painel pode remontar sem perder o
// terminal.
const sessions = new Map<string, TerminalSession>()

export const TERMINAL_PREFIX = 'terminal:'
export const AGENT_PREFIX = 'agent:'

export function isTerminalPanel(id: string): boolean {
  return id.startsWith(TERMINAL_PREFIX)
}

export function isAgentPanel(id: string): boolean {
  return id.startsWith(AGENT_PREFIX)
}

export function agentPanelId(taskId: string): string {
  return `${AGENT_PREFIX}${taskId}`
}

export function getOrCreateSession(id: string, options: SessionOptions): TerminalSession {
  let session = sessions.get(id)
  if (!session) {
    session = new TerminalSession(options)
    sessions.set(id, session)
  }
  return session
}

export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id)
}

export function sessionIds(): string[] {
  return [...sessions.keys()]
}

export function disposeSession(id: string): void {
  sessions.get(id)?.dispose()
  sessions.delete(id)
}
