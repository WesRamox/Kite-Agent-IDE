import { z } from 'zod'
import { THEMES, type ThemeId } from '@shared/themes'
import type { Logger } from '../lib/logger'
import type { SettingsService } from '../services/settings.service'
import { registerHandler } from './register'

export const themeSchema = z.enum(THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]])

export function registerSettingsIpc(settings: SettingsService, log: Logger): void {
  registerHandler('settings:get', z.tuple([]), () => settings.get(), log)
  registerHandler('settings:setTheme', z.tuple([themeSchema]), (t) => settings.setTheme(t), log)
}
