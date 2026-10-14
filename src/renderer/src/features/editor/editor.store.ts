import { create } from 'zustand'

export interface TabMeta {
  dirty: boolean
  language: string
}

interface EditorState {
  tabs: Record<string, TabMeta>
  activePath: string | null
  cursor: { line: number; column: number } | null
  setTab: (path: string, meta: TabMeta) => void
  setDirty: (path: string, dirty: boolean) => void
  removeTab: (path: string) => void
  setActive: (path: string | null) => void
  setCursor: (cursor: { line: number; column: number } | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tabs: {},
  activePath: null,
  cursor: null,
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
}))
