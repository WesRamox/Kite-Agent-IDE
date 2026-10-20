import { z } from 'zod'
import { workspaceCanvasSchema } from '../lib/canvas-schema'
import { toolResultSchema } from '../lib/canvas-tools-schema'
import type { Logger } from '../lib/logger'
import type { CanvasBridgeService } from '../services/canvas-bridge.service'
import type { CanvasService } from '../services/canvas.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const id = z.string().min(1).max(200)

export function registerCanvasIpc(
  canvas: CanvasService,
  bridge: CanvasBridgeService,
  // Print de um navegador do quadro (só guests da janela do Kite; ver register-ipc).
  capture: (webContentsId: number) => Promise<string>,
  log: Logger,
): void {
  registerHandler('canvas:load', z.tuple([absPath]), (root) => canvas.load(root), log)
  registerHandler(
    'canvas:save',
    z.tuple([absPath, workspaceCanvasSchema]),
    (root, state) => canvas.save(root, state),
    log,
  )
  registerHandler(
    'canvas:toolReply',
    z.tuple([id, toolResultSchema]),
    (requestId, result) => bridge.reply(requestId, result),
    log,
  )
  registerHandler(
    'canvas:launchCommand',
    z.tuple([id, id]),
    (presetId, nodeId) => bridge.launchCommand(presetId, nodeId),
    log,
  )
  registerHandler('canvas:capture', z.tuple([z.number().int().positive()]), capture, log)
}
