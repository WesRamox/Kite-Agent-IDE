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
    confirmClose: invoke('app:confirmClose'),
    onCloseRequested: (listener) => subscribe('app:closeRequested')(() => listener()),
  },
  clipboard: {
    readText: invoke('clipboard:readText'),
    writeText: invoke('clipboard:writeText'),
  },
  github: {
    me: invoke('github:me'),
    startDeviceFlow: invoke('github:startDeviceFlow'),
    pollDeviceFlow: invoke('github:pollDeviceFlow'),
    logout: invoke('github:logout'),
    repo: invoke('github:repo'),
    listPRs: invoke('github:listPRs'),
    listIssues: invoke('github:listIssues'),
    getPR: invoke('github:getPR'),
    getIssue: invoke('github:getIssue'),
    createPR: invoke('github:createPR'),
    checkoutPR: invoke('github:checkoutPR'),
  },
  pty: {
    create: invoke('pty:create'),
    write: invoke('pty:write'),
    resize: invoke('pty:resize'),
    kill: invoke('pty:kill'),
    onData: subscribe('pty:data'),
    onExit: subscribe('pty:exit'),
  },
  terminal: {
    loadSessions: invoke('terminal:loadSessions'),
    saveSessions: invoke('terminal:saveSessions'),
  },
  dialog: {
    confirm: invoke('dialog:confirm'),
  },
  workspace: {
    openFolderDialog: invoke('fs:openFolderDialog'),
    openRecent: invoke('workspace:openRecent'),
    recent: invoke('workspace:recent'),
    removeRecent: invoke('workspace:removeRecent'),
    openWorktree: invoke('workspace:openWorktree'),
  },
  git: {
    status: invoke('git:status'),
    diff: invoke('git:diff'),
    stage: invoke('git:stage'),
    unstage: invoke('git:unstage'),
    commit: invoke('git:commit'),
    branches: invoke('git:branches'),
    checkout: invoke('git:checkout'),
    worktreeList: invoke('git:worktreeList'),
    worktreeAdd: invoke('git:worktreeAdd'),
    worktreeRemove: invoke('git:worktreeRemove'),
    watch: invoke('git:watch'),
    unwatch: invoke('git:unwatch'),
    onChanged: subscribe('git:changed'),
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
