import { create } from 'zustand'

export type ToastKind = 'info' | 'warning' | 'error'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  push: (kind: ToastKind, message: string, action?: ToastAction) => void
  dismiss: (id: number) => void
}

const DURATION_MS = 5000
// Com botão, fica mais tempo: dá para terminar o que estava fazendo e clicar.
const ACTION_DURATION_MS = 15000
let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, action) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, kind, message, action }] }))
    setTimeout(() => get().dismiss(id), action ? ACTION_DURATION_MS : DURATION_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  info: (m: string) => useToastStore.getState().push('info', m),
  warning: (m: string) => useToastStore.getState().push('warning', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  action: (m: string, action: ToastAction) => useToastStore.getState().push('info', m, action),
}
