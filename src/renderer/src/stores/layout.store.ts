import { create } from 'zustand'

export type SidebarView = 'attention' | 'explorer' | 'git' | 'github'

interface LayoutState {
  activeView: SidebarView
  sidebarVisible: boolean
  // Clicar no ícone da view ativa recolhe/expande a sidebar, como no VS Code.
  selectView: (view: SidebarView) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeView: 'explorer',
  sidebarVisible: true,
  selectView: (view) =>
    set((s) =>
      s.activeView === view
        ? { sidebarVisible: !s.sidebarVisible }
        : { activeView: view, sidebarVisible: true },
    ),
}))
