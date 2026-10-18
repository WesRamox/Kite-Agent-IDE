// Configurações, informações do app e diálogos.
import type { ThemeId } from '../themes'

export type AppLanguage = 'pt-BR' | 'en'

export interface AppSettings {
  theme: ThemeId
  language: AppLanguage
  editorFontSize: number
  terminalFontSize: number
  // Salvar o histórico dos terminais ao fechar e restaurar ao reabrir.
  restoreTerminals: boolean
  // Notificações nativas quando um agente espera ou termina.
  notifications: boolean
}

export type SettingsPatch = Partial<Omit<AppSettings, 'theme'>>

export interface AppInfo {
  name: string
  version: string
  platform: string
  versions: { electron: string; chrome: string; node: string }
}

export interface ConfirmOptions {
  message: string
  detail?: string
  // O primeiro botão é a ação principal; o último é o cancelamento.
  buttons: string[]
  kind?: 'info' | 'warning' | 'question'
}
