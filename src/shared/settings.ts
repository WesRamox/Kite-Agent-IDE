import { DEFAULT_THEME } from './themes'
import type { AppSettings } from './types'

// Padrões das configurações (main e renderer usam os mesmos).
export const FONT_MIN = 10
export const FONT_MAX = 24

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  language: 'pt-BR',
  editorFontSize: 13,
  terminalFontSize: 13,
  restoreTerminals: true,
  notifications: true,
}
