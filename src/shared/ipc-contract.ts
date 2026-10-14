// Fonte única de verdade de todos os canais IPC.
// Request/response: nome `dominio:acao`, via ipcMain.handle / ipcRenderer.invoke.
// Eventos main → renderer: nome `dominio:evento`, via webContents.send.
// Os canais de cada domínio entram aqui na fase em que o domínio é implementado.

import type { AppInfo, Result } from './types'

export interface InvokeChannels {
  'app:getInfo': { args: []; result: AppInfo }
}

// Vazio na Fase 0; recebe `fs:changed`, `pty:data`, `pty:exit`, `agent:status`.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EventChannels {}

export type InvokeChannel = keyof InvokeChannels
export type InvokeArgs<C extends InvokeChannel> = InvokeChannels[C]['args']
export type InvokeData<C extends InvokeChannel> = InvokeChannels[C]['result']
export type InvokeResult<C extends InvokeChannel> = Result<InvokeData<C>>

export type EventChannel = keyof EventChannels

// API exposta ao renderer como `window.api`. Apenas funções nomeadas.
export interface Api {
  app: {
    getInfo: () => Promise<InvokeResult<'app:getInfo'>>
  }
}
