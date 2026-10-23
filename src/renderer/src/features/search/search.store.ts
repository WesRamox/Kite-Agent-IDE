import type { SearchQuery } from '@shared/types'
import { create } from 'zustand'

type Flag = 'caseSensitive' | 'wholeWord' | 'regex'

interface SearchState extends SearchQuery {
  showFilters: boolean
  // Arquivos e repos recolhidos nos resultados (por caminho).
  collapsed: Record<string, boolean>
  // Muda a cada Ctrl+Shift+F: a view foca e seleciona o campo de busca.
  focusSeq: number
  set: (patch: Partial<Pick<SearchState, keyof SearchQuery | 'showFilters'>>) => void
  toggle: (flag: Flag) => void
  toggleCollapsed: (key: string) => void
  requestFocus: () => void
}

// A busca continua a mesma ao trocar de view ou de tarefa (como no VS Code).
export const useSearchStore = create<SearchState>((set) => ({
  text: '',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  include: '',
  exclude: '',
  showFilters: false,
  collapsed: {},
  focusSeq: 0,
  set: (patch) => set(patch),
  toggle: (flag) => set((s) => ({ [flag]: !s[flag] })),
  toggleCollapsed: (key) =>
    set((s) => ({ collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } })),
  requestFocus: () => set((s) => ({ focusSeq: s.focusSeq + 1 })),
}))
