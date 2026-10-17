import { create } from 'zustand'
import { attempt } from '../../lib/ipc'
import { relative } from '../../lib/paths'
import { toast } from '../../stores/toast.store'
import { t } from '../../lib/i18n'

// Pastas em que o quick open busca: a pasta aberta ou, numa tarefa, cada worktree (com o nome
// do repo na frente do caminho).
export interface QuickOpenRoot {
  path: string
  label: string | null
}

export interface QuickOpenFile {
  path: string
  rel: string
}

interface QuickOpenState {
  open: boolean
  files: QuickOpenFile[] | null
  loading: boolean
  show: () => void
  hide: () => void
  invalidate: () => void
  ensureFiles: (roots: QuickOpenRoot[]) => Promise<void>
}

let inflight: Promise<void> | null = null

export const useQuickOpenStore = create<QuickOpenState>((set, get) => ({
  open: false,
  files: null,
  loading: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  invalidate: () => set({ files: null }),
  ensureFiles: (roots) => {
    if (get().files) return Promise.resolve()
    // Chamadas concorrentes esperam a mesma carga.
    inflight ??= (async () => {
      set({ loading: true })
      const lists = await Promise.all(
        roots.map(async (r) => {
          const res = await attempt(window.api.fs.listFiles(r.path), t('quickOpen.listError'))
          if (res?.truncated) toast.warning(t('quickOpen.truncated'))
          return (res?.files ?? []).map((path) => {
            const rel = relative(r.path, path)
            return { path, rel: r.label ? `${r.label}/${rel}` : rel }
          })
        }),
      )
      set({ loading: false, files: lists.flat() })
    })().finally(() => {
      inflight = null
    })
    return inflight
  },
}))
