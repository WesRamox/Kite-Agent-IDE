import type { AppSettings } from '@shared/types'
import { DEFAULT_THEME, type ThemeId } from '@shared/themes'
import type { JsonStore } from '../lib/json-store'

export interface SettingsServiceDeps {
  store: JsonStore<AppSettings>
  // Aplica o tema fora do renderer (fundo da janela, diálogos nativos claros/escuros).
  applyTheme: (theme: ThemeId) => void
}

export class SettingsService {
  private settings: AppSettings = { theme: DEFAULT_THEME }

  constructor(private readonly deps: SettingsServiceDeps) {}

  async init(): Promise<AppSettings> {
    this.settings = await this.deps.store.read()
    this.deps.applyTheme(this.settings.theme)
    return this.settings
  }

  get(): AppSettings {
    return this.settings
  }

  async setTheme(theme: ThemeId): Promise<AppSettings> {
    this.settings = { ...this.settings, theme }
    this.deps.applyTheme(theme)
    await this.deps.store.write(this.settings)
    return this.settings
  }
}
