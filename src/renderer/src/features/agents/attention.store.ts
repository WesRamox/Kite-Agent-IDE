import { create } from 'zustand'

interface AttentionState {
  // O que a sidebar da Central mostra abaixo do cabeçalho.
  mode: 'list' | 'new' | 'presets'
  // Item destacado na Central (clique na sidebar, Ctrl+J, notificação).
  highlighted: string | null
  set: (patch: Partial<Pick<AttentionState, 'mode' | 'highlighted'>>) => void
}

export const useAttentionStore = create<AttentionState>((set) => ({
  mode: 'list',
  highlighted: null,
  set: (patch) => set(patch),
}))
