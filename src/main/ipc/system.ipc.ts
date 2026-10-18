import { z } from 'zod'
import type { Logger } from '../lib/logger'
import { registerHandler } from './register'

export interface SystemDeps {
  readClipboard: () => string | Promise<string>
  writeClipboard: (text: string) => void
  confirmClose: () => void | Promise<void>
  // Janela sem a barra de título do sistema: os botões ficam na barra de menus do Kite.
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => boolean
  }
}

export function registerSystemIpc(deps: SystemDeps, log: Logger): void {
  registerHandler('clipboard:readText', z.tuple([]), () => deps.readClipboard(), log)
  registerHandler(
    'clipboard:writeText',
    z.tuple([z.string().max(10_000_000)]),
    (text) => deps.writeClipboard(text),
    log,
  )
  registerHandler('app:confirmClose', z.tuple([]), () => deps.confirmClose(), log)
  registerHandler('window:minimize', z.tuple([]), () => deps.window.minimize(), log)
  registerHandler('window:toggleMaximize', z.tuple([]), () => deps.window.toggleMaximize(), log)
  registerHandler('window:close', z.tuple([]), () => deps.window.close(), log)
  registerHandler('window:isMaximized', z.tuple([]), () => deps.window.isMaximized(), log)
}
