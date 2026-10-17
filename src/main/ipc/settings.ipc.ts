import { z } from 'zod'
import type { Logger } from '../lib/logger'
import { settingsPatchSchema, themeSchema } from '../lib/settings-schema'
import type { SettingsService } from '../services/settings.service'
import { registerHandler } from './register'

export { themeSchema }

export function registerSettingsIpc(settings: SettingsService, log: Logger): void {
  registerHandler('settings:get', z.tuple([]), () => settings.get(), log)
  registerHandler('settings:setTheme', z.tuple([themeSchema]), (t) => settings.setTheme(t), log)
  registerHandler(
    'settings:update',
    z.tuple([settingsPatchSchema]),
    (patch) => settings.update(patch),
    log,
  )
}
