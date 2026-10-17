import type { AgentCli, AgentSession, HooksStatus } from '@shared/types'
import { create } from 'zustand'

interface SessionsState {
  sessions: AgentSession[]
  // Integração de cada CLI (Claude Code, Codex, Gemini).
  hooks: Partial<Record<AgentCli, HooksStatus>>
  set: (patch: Partial<Pick<SessionsState, 'sessions' | 'hooks'>>) => void
  upsert: (session: AgentSession) => void
}

// Sessões de agentes vistas pelos hooks (Fase 6), as mais recentes primeiro.
export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  hooks: {},
  set: (patch) => set(patch),
  upsert: (session) =>
    set((s) => ({
      sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
    })),
}))
