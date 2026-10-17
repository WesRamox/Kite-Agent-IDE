import type { AgentSession, HooksStatus } from '@shared/types'
import { create } from 'zustand'

interface SessionsState {
  sessions: AgentSession[]
  hooks: HooksStatus | null
  set: (patch: Partial<Pick<SessionsState, 'sessions' | 'hooks'>>) => void
  upsert: (session: AgentSession) => void
}

// Sessões de agentes vistas pelos hooks (Fase 6), as mais recentes primeiro.
export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  hooks: null,
  set: (patch) => set(patch),
  upsert: (session) =>
    set((s) => ({
      sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
    })),
}))
