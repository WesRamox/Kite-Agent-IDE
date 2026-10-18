import { useThemeStore } from '../../stores/theme.store'
import { TerminalSession, type SessionOptions } from './terminal-session'
import { terminalTheme } from './terminal-theme'

// Sessões vivas por id de painel. Ficam fora do React: o painel pode remontar sem perder o
// terminal.
const sessions = new Map<string, TerminalSession>()

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

// Painel do terminal que roda o PTY `ptyId` (shell próprio ou agente).
export function panelByPty(ptyId: string): string | undefined {
  for (const [id, session] of sessions) if (session.pty === ptyId) return id
  return undefined
}

export function disposeSession(id: string): void {
  sessions.get(id)?.dispose()
  sessions.delete(id)
}

// Troca de tema: atualiza os terminais abertos.
useThemeStore.subscribe((state, prev) => {
  if (state.theme === prev.theme) return
  const theme = terminalTheme(state.theme)
  for (const session of sessions.values()) session.setTheme(theme)
})
