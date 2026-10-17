import { DEFAULT_SETTINGS } from '@shared/settings'
import type { AppSettings, SettingsPatch } from '@shared/types'
import { create } from 'zustand'
import { attempt } from '../lib/ipc'

// Configurações do app (settings.json no main). O tema tem store próprio (theme.store), que
// aplica antes do primeiro paint; aqui ficam as demais.
interface SettingsState {
  settings: AppSettings
  load: () => Promise<void>
  update: (patch: SettingsPatch) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  load: async () => {
    const res = await window.api.settings.get()
    if (res.ok) set({ settings: res.data })
  },
  update: async (patch) => {
    // Otimista: a tela responde na hora; se o main recusar, volta ao que estava.
    const before = get().settings
    set({ settings: { ...before, ...patch } })
    const saved = await attempt(window.api.settings.update(patch), 'Erro ao salvar a configuração')
    set({ settings: saved ?? before })
  },
}))
