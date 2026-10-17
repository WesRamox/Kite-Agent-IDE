import { create } from 'zustand'
import { setActiveContext, WORKSPACE_CONTEXT } from '../lib/dock'

// Contextos da área principal: o workspace e as tarefas abertas (um dock para cada).
interface ContextState {
  contexts: string[]
  active: string
  activate: (context: string) => void
  close: (context: string) => void
  reset: () => void
}

export const useContextStore = create<ContextState>((set) => ({
  contexts: [WORKSPACE_CONTEXT],
  active: WORKSPACE_CONTEXT,
  activate: (context) => {
    setActiveContext(context)
    set((s) => ({
      active: context,
      contexts: s.contexts.includes(context) ? s.contexts : [...s.contexts, context],
    }))
  },
  close: (context) => {
    if (context === WORKSPACE_CONTEXT) return
    set((s) => {
      const active = s.active === context ? WORKSPACE_CONTEXT : s.active
      setActiveContext(active)
      return { contexts: s.contexts.filter((c) => c !== context), active }
    })
  },
  reset: () => {
    setActiveContext(WORKSPACE_CONTEXT)
    set({ contexts: [WORKSPACE_CONTEXT], active: WORKSPACE_CONTEXT })
  },
}))
