import { create } from 'zustand'

export type SidebarView = 'attention' | 'explorer' | 'git' | 'github'

// Largura da sidebar: 288 px como no canvas, ajustável arrastando a borda.
export const SIDEBAR_DEFAULT = 288
export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 640
const WIDTH_KEY = 'kite.sidebarWidth'

export function clampSidebar(width: number): number {
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)))
}

// Conveniência por usuário: se o armazenamento falhar, volta para a largura padrão.
function savedWidth(): number {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY))
    return value > 0 ? clampSidebar(value) : SIDEBAR_DEFAULT
  } catch {
    return SIDEBAR_DEFAULT
  }
}

interface LayoutState {
  activeView: SidebarView
  sidebarVisible: boolean
  sidebarWidth: number
  // Clicar no ícone da view ativa recolhe/expande a sidebar, como no VS Code.
  selectView: (view: SidebarView) => void
  setSidebarWidth: (width: number, persist?: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeView: 'explorer',
  sidebarVisible: true,
  sidebarWidth: savedWidth(),
  selectView: (view) =>
    set((s) =>
      s.activeView === view
        ? { sidebarVisible: !s.sidebarVisible }
        : { activeView: view, sidebarVisible: true },
    ),
  setSidebarWidth: (width, persist = true) => {
    const value = clampSidebar(width)
    set({ sidebarWidth: value })
    if (!persist) return
    try {
      localStorage.setItem(WIDTH_KEY, String(value))
    } catch {
      // Sem armazenamento: a largura vale só até fechar o app.
    }
  },
}))
