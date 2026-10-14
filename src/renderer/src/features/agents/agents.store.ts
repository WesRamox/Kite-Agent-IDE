import type { AgentPreset, AgentTask } from '@shared/types'
import { create } from 'zustand'

interface AgentsState {
  tasks: AgentTask[]
  presets: AgentPreset[]
  // Tarefa destacada (ex.: clique na notificação).
  focused: string | null
  set: (patch: Partial<Omit<AgentsState, 'set' | 'upsert'>>) => void
  upsert: (task: AgentTask & { removed?: boolean }) => void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  tasks: [],
  presets: [],
  focused: null,
  set: (patch) => set(patch),
  upsert: ({ removed, ...task }) =>
    set((s) => {
      if (removed) return { tasks: s.tasks.filter((t) => t.id !== task.id) }
      const exists = s.tasks.some((t) => t.id === task.id)
      return {
        tasks: exists ? s.tasks.map((t) => (t.id === task.id ? task : t)) : [task, ...s.tasks],
      }
    }),
}))
