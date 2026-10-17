import { create } from 'zustand'

// Telas que abrem numa janela sobreposta, por cima do Kite (fecham com Esc, no X ou fora).
export type ModalId = 'central' | 'connect' | 'settings'

interface ModalState {
  open: ModalId | null
  show: (id: ModalId) => void
  close: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  open: null,
  show: (id) => set({ open: id }),
  close: () => set({ open: null }),
}))

// Ações que levam para o editor, um terminal ou outra tarefa fecham a janela sobreposta.
export function closeModal(): void {
  if (useModalStore.getState().open) useModalStore.getState().close()
}
