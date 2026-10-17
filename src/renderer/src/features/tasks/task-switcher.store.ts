import { create } from 'zustand'

interface TaskSwitcherState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useTaskSwitcherStore = create<TaskSwitcherState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
