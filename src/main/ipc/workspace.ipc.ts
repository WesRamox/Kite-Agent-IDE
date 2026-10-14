import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { WorkspaceService } from '../services/workspace.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

export function registerWorkspaceIpc(service: WorkspaceService, log: Logger): void {
  registerHandler('fs:openFolderDialog', z.tuple([]), () => service.openFolderDialog(), log)
  registerHandler('workspace:openRecent', z.tuple([absPath]), (p) => service.openRecent(p), log)
  registerHandler('workspace:recent', z.tuple([]), () => service.recent(), log)
  registerHandler('workspace:removeRecent', z.tuple([absPath]), (p) => service.removeRecent(p), log)
}
