import { create } from 'zustand'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'

interface QuickOpenState {
  open: boolean
  files: string[] | null
  loading: boolean
  show: () => void
  hide: () => void
  invalidate: () => void
  ensureFiles: (root: string) => Promise<void>
}

export const useQuickOpenStore = create<QuickOpenState>((set, get) => ({
  open: false,
  files: null,
  loading: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  invalidate: () => set({ files: null }),
  ensureFiles: async (root) => {
    if (get().files || get().loading) return
    set({ loading: true })
    const res = await attempt(window.api.fs.listFiles(root), 'Erro ao listar arquivos')
    set({ loading: false, files: res?.files ?? [] })
    if (res?.truncated) toast.warning('Projeto grande: o quick open mostra só parte dos arquivos.')
  },
}))
