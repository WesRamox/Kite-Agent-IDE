import type { DirEntry } from '@shared/types'
import { create } from 'zustand'
import { attempt } from '../../lib/ipc'
import { isInside } from '../../lib/paths'
import { t } from '../../lib/i18n'

export interface PendingCreate {
  parent: string
  kind: 'file' | 'directory'
}

interface ExplorerState {
  // Conteúdo das pastas já carregadas (lazy), indexado pelo caminho da pasta.
  children: Record<string, DirEntry[]>
  pendingCreate: PendingCreate | null
  renaming: string | null
  reset: () => void
  load: (dir: string) => Promise<void>
  refresh: (dirs: Iterable<string>) => Promise<void>
  forget: (dir: string) => void
  startCreate: (pending: PendingCreate) => void
  startRename: (path: string) => void
  stopEditing: () => void
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  children: {},
  pendingCreate: null,
  renaming: null,
  reset: () => set({ children: {}, pendingCreate: null, renaming: null }),
  load: async (dir) => {
    const entries = await attempt(window.api.fs.readDir(dir), t('explorer.readError'))
    if (entries) set((s) => ({ children: { ...s.children, [dir]: entries } }))
  },
  // Recarrega só as pastas que já estão carregadas.
  refresh: async (dirs) => {
    const loaded = [...new Set(dirs)].filter((d) => d in get().children)
    const results = await Promise.all(
      loaded.map(async (d) => [d, await window.api.fs.readDir(d)] as const),
    )
    set((s) => {
      const failed = new Set(results.filter(([, res]) => !res.ok).map(([dir]) => dir))
      const children = Object.fromEntries(
        Object.entries(s.children).filter(([dir]) => !failed.has(dir)),
      )
      for (const [dir, res] of results) if (res.ok) children[dir] = res.data
      return { children }
    })
  },
  // Pasta removida: descarta ela e as subpastas carregadas.
  forget: (dir) =>
    set((s) => ({
      children: Object.fromEntries(Object.entries(s.children).filter(([d]) => !isInside(dir, d))),
    })),
  startCreate: (pendingCreate) => set({ pendingCreate, renaming: null }),
  startRename: (renaming) => set({ renaming, pendingCreate: null }),
  stopEditing: () => set({ pendingCreate: null, renaming: null }),
}))
