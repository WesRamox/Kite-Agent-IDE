import { DEFAULT_SETTINGS } from '@shared/settings'
import type { AppSettings, SettingsPatch } from '@shared/types'
import { create } from 'zustand'
import { t } from '../lib/i18n'
import { attempt } from '../lib/ipc'

// Configurações do app (settings.json no main). O tema tem store próprio (theme.store), que
// aplica antes do primeiro paint; aqui ficam as demais.
// Idioma em cache: a interface abre no idioma certo antes de o main responder.
const LANG_KEY = 'kite.language'

function cachedLanguage(): AppSettings['language'] {
  try {
    const value = localStorage.getItem(LANG_KEY)
    return value === 'en' || value === 'pt-BR' ? value : DEFAULT_SETTINGS.language
  } catch {
    return DEFAULT_SETTINGS.language
  }
}

function applyLanguage(lang: AppSettings['language']): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // sem armazenamento: só vale até fechar
  }
}

interface SettingsState {
  settings: AppSettings
  load: () => Promise<void>
  update: (patch: SettingsPatch) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS, language: cachedLanguage() },
  load: async () => {
    const res = await window.api.settings.get()
    if (!res.ok) return
    applyLanguage(res.data.language)
    set({ settings: res.data })
  },
  update: async (patch) => {
    // Otimista: a tela responde na hora; se o main recusar, volta ao que estava.
    const before = get().settings
    set({ settings: { ...before, ...patch } })
    const saved = await attempt(window.api.settings.update(patch), t('settings.saveError'))
    const next = saved ?? before
    applyLanguage(next.language)
    set({ settings: next })
  },
}))

if (typeof document !== 'undefined') {
  document.documentElement.lang = useSettingsStore.getState().settings.language
}
