import { create } from 'zustand'
import { attempt } from '../lib/ipc'

interface WorkspaceState {
  root: string | null
  recent: string[]
  setRoot: (root: string | null) => void
  loadRecent: () => Promise<void>
  removeRecent: (path: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  root: null,
  recent: [],
  setRoot: (root) => set({ root }),
  loadRecent: async () => {
    const recent = await attempt(window.api.workspace.recent(), 'Erro ao ler pastas recentes')
    if (recent) set({ recent })
  },
  removeRecent: async (path) => {
    const recent = await attempt(window.api.workspace.removeRecent(path), 'Erro')
    if (recent) set({ recent })
  },
}))
