// Fonte única de verdade de todos os canais IPC.
// Request/response: nome `dominio:acao`, via ipcMain.handle / ipcRenderer.invoke.
// Eventos main → renderer: nome `dominio:evento`, via webContents.send.
// Os canais de cada domínio entram aqui na fase em que o domínio é implementado.

import type {
  AppInfo,
  ConfirmOptions,
  DirEntry,
  FileContent,
  FileEncoding,
  FsChangedEvent,
  Result,
} from './types'

export interface InvokeChannels {
  'app:getInfo': { args: []; result: AppInfo }

  'dialog:confirm': { args: [options: ConfirmOptions]; result: number }

  // Workspace: só o main decide quais pastas são raízes permitidas.
  'fs:openFolderDialog': { args: []; result: string | null }
  'workspace:openRecent': { args: [path: string]; result: string }
  'workspace:recent': { args: []; result: string[] }
  'workspace:removeRecent': { args: [path: string]; result: string[] }

  'fs:readDir': { args: [path: string]; result: DirEntry[] }
  'fs:readFile': { args: [path: string]; result: FileContent }
  'fs:writeFile': { args: [path: string, content: string, encoding: FileEncoding]; result: void }
  'fs:create': { args: [path: string, kind: 'file' | 'directory']; result: void }
  'fs:rename': { args: [from: string, to: string]; result: void }
  'fs:delete': { args: [path: string]; result: void }
  'fs:listFiles': { args: [root: string]; result: { files: string[]; truncated: boolean } }
  'fs:watch': { args: [root: string]; result: void }
  'fs:unwatch': { args: [root: string]; result: void }
}

export interface EventChannels {
  'fs:changed': FsChangedEvent
}

export type InvokeChannel = keyof InvokeChannels
export type InvokeArgs<C extends InvokeChannel> = InvokeChannels[C]['args']
export type InvokeData<C extends InvokeChannel> = InvokeChannels[C]['result']
export type InvokeResult<C extends InvokeChannel> = Result<InvokeData<C>>

export type EventChannel = keyof EventChannels
export type Unsubscribe = () => void

type Fn<C extends InvokeChannel> = (...args: InvokeArgs<C>) => Promise<InvokeResult<C>>

// API exposta ao renderer como `window.api`. Apenas funções nomeadas.
export interface Api {
  app: {
    getInfo: Fn<'app:getInfo'>
  }
  dialog: {
    confirm: Fn<'dialog:confirm'>
  }
  workspace: {
    openFolderDialog: Fn<'fs:openFolderDialog'>
    openRecent: Fn<'workspace:openRecent'>
    recent: Fn<'workspace:recent'>
    removeRecent: Fn<'workspace:removeRecent'>
  }
  fs: {
    readDir: Fn<'fs:readDir'>
    readFile: Fn<'fs:readFile'>
    writeFile: Fn<'fs:writeFile'>
    create: Fn<'fs:create'>
    rename: Fn<'fs:rename'>
    delete: Fn<'fs:delete'>
    listFiles: Fn<'fs:listFiles'>
    watch: Fn<'fs:watch'>
    unwatch: Fn<'fs:unwatch'>
    onChanged: (listener: (event: FsChangedEvent) => void) => Unsubscribe
  }
}
