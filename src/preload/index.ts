import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  Api,
  EventChannel,
  EventChannels,
  InvokeArgs,
  InvokeChannel,
  InvokeResult,
  Unsubscribe,
} from '@shared/ipc-contract'

function invoke<C extends InvokeChannel>(
  channel: C,
): (...args: InvokeArgs<C>) => Promise<InvokeResult<C>> {
  return (...args) => ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>
}

function subscribe<E extends EventChannel>(
  channel: E,
): (listener: (payload: EventChannels[E]) => void) => Unsubscribe {
  return (listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: EventChannels[E]): void => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

const api: Api = {
  app: {
    getInfo: invoke('app:getInfo'),
  },
  dialog: {
    confirm: invoke('dialog:confirm'),
  },
  workspace: {
    openFolderDialog: invoke('fs:openFolderDialog'),
    openRecent: invoke('workspace:openRecent'),
    recent: invoke('workspace:recent'),
    removeRecent: invoke('workspace:removeRecent'),
  },
  fs: {
    readDir: invoke('fs:readDir'),
    readFile: invoke('fs:readFile'),
    writeFile: invoke('fs:writeFile'),
    create: invoke('fs:create'),
    rename: invoke('fs:rename'),
    delete: invoke('fs:delete'),
    listFiles: invoke('fs:listFiles'),
    watch: invoke('fs:watch'),
    unwatch: invoke('fs:unwatch'),
    onChanged: subscribe('fs:changed'),
  },
}

contextBridge.exposeInMainWorld('api', api)
