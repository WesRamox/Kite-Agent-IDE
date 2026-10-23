import { create } from 'zustand'

// Onde pôr o cursor ao abrir um arquivo (resultado da busca): linha e coluna 1-based e quantos
// caracteres selecionar. `seq` distingue dois pedidos iguais seguidos.
export interface EditorReveal {
  path: string
  line: number
  column: number
  length: number
  seq: number
}

export interface TabMeta {
  dirty: boolean
  language: string
}

interface EditorState {
  tabs: Record<string, TabMeta>
  activePath: string | null
  cursor: { line: number; column: number } | null
  reveal: EditorReveal | null
  setTab: (path: string, meta: TabMeta) => void
  setDirty: (path: string, dirty: boolean) => void
  removeTab: (path: string) => void
  setActive: (path: string | null) => void
  setCursor: (cursor: { line: number; column: number } | null) => void
  requestReveal: (reveal: Omit<EditorReveal, 'seq'>) => void
  // Só limpa se ainda for o mesmo pedido (outro pode ter chegado enquanto o editor abria).
  clearReveal: (seq: number) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tabs: {},
  activePath: null,
  cursor: null,
  reveal: null,
  setTab: (path, meta) => set((s) => ({ tabs: { ...s.tabs, [path]: meta } })),
  setDirty: (path, dirty) =>
    set((s) => {
      const tab = s.tabs[path]
      if (!tab || tab.dirty === dirty) return s
      return { tabs: { ...s.tabs, [path]: { ...tab, dirty } } }
    }),
  removeTab: (path) =>
    set((s) => {
      const { [path]: _removed, ...tabs } = s.tabs
      return { tabs, activePath: s.activePath === path ? null : s.activePath }
    }),
  setActive: (activePath) => set({ activePath, cursor: null }),
  setCursor: (cursor) => set({ cursor }),
  requestReveal: (reveal) => set((s) => ({ reveal: { ...reveal, seq: (s.reveal?.seq ?? 0) + 1 } })),
  clearReveal: (seq) => set((s) => (s.reveal?.seq === seq ? { reveal: null } : s)),
}))
