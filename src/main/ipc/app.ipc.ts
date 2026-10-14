import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { AppService } from '../services/app.service'
import { registerHandler } from './register'

export function registerAppIpc(service: AppService, log: Logger): void {
  registerHandler('app:getInfo', z.tuple([]), () => service.getInfo(), log)
}
