import { create } from 'zustand'

interface TerminalUiState {
  // Painel de terminal com a barra de busca aberta.
  searchOpen: string | null
  openSearch: (id: string) => void
  closeSearch: () => void
}

export const useTerminalUiStore = create<TerminalUiState>((set) => ({
  searchOpen: null,
  openSearch: (id) => set({ searchOpen: id }),
  closeSearch: () => set({ searchOpen: null }),
}))
