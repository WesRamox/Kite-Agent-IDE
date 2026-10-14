import { DEFAULT_THEME, isThemeId, themeInfo, type ThemeId } from '@shared/themes'
import { create } from 'zustand'

const CACHE_KEY = 'kite.theme'

// Cópia local do tema para aplicar antes do primeiro paint (a fonte da verdade é o main).
export function cachedTheme(): ThemeId {
  try {
    const value = localStorage.getItem(CACHE_KEY)
    return isThemeId(value) ? value : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function applyToDocument(theme: ThemeId): void {
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.themeKind = themeInfo(theme).kind
  try {
    localStorage.setItem(CACHE_KEY, theme)
  } catch {
    // sem armazenamento local: o tema ainda vem do main na próxima abertura
  }
}

interface ThemeState {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  syncFromMain: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: cachedTheme(),
  setTheme: (theme) => {
    applyToDocument(theme)
    set({ theme })
    void window.api.settings.setTheme(theme)
  },
  syncFromMain: async () => {
    const res = await window.api.settings.get()
    if (res.ok && res.data.theme !== get().theme) {
      applyToDocument(res.data.theme)
      set({ theme: res.data.theme })
    }
  },
}))

applyToDocument(useThemeStore.getState().theme)
