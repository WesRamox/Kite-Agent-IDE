import { contextBridge, ipcRenderer } from 'electron'
import type { Api, InvokeArgs, InvokeChannel, InvokeResult } from '@shared/ipc-contract'

function invoke<C extends InvokeChannel>(
  channel: C,
  ...args: InvokeArgs<C>
): Promise<InvokeResult<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>
}

const api: Api = {
  app: {
    getInfo: () => invoke('app:getInfo'),
  },
}

contextBridge.exposeInMainWorld('api', api)
