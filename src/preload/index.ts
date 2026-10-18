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
  settings: {
    get: invoke('settings:get'),
    setTheme: invoke('settings:setTheme'),
    update: invoke('settings:update'),
  },
  clipboard: {
    readText: invoke('clipboard:readText'),
    writeText: invoke('clipboard:writeText'),
  },
  agent: {
    presets: invoke('agent:presets'),
    savePresets: invoke('agent:savePresets'),
    list: invoke('agent:list'),
    start: invoke('agent:start'),
    stop: invoke('agent:stop'),
    restart: invoke('agent:restart'),
    remove: invoke('agent:remove'),
    attach: invoke('agent:attach'),
    review: invoke('agent:review'),
    reviewDiff: invoke('agent:reviewDiff'),
    startInTask: invoke('agent:startInTask'),
    onStatus: subscribe('agent:status'),
    onFocus: subscribe('agent:focus'),
  },
  agentSession: {
    list: invoke('agentSession:list'),
    review: invoke('agentSession:review'),
    reviewDiff: invoke('agentSession:reviewDiff'),
    pending: invoke('agentSession:pending'),
    dismissed: invoke('review:dismissed'),
    dismiss: invoke('review:dismiss'),
    onChanged: subscribe('agentSession:changed'),
    onFocus: subscribe('agentSession:focus'),
  },
  task: {
    discover: invoke('task:discover'),
    watch: invoke('task:watch'),
    setGrouping: invoke('task:setGrouping'),
    rename: invoke('task:rename'),
    move: invoke('task:move'),
    ignore: invoke('task:ignore'),
    import: invoke('task:import'),
    setHidden: invoke('task:setHidden'),
    setNotes: invoke('task:setNotes'),
    linkSession: invoke('task:linkSession'),
    addExternalRepo: invoke('task:addExternalRepo'),
    open: invoke('task:open'),
    addRepo: invoke('task:addRepo'),
    create: invoke('task:create'),
    onChanged: subscribe('task:changed'),
  },
  review: {
    task: invoke('review:task'),
    changes: invoke('review:changes'),
    diff: invoke('review:diff'),
    prs: invoke('review:prs'),
    deliver: invoke('review:deliver'),
  },
  hooks: {
    status: invoke('hooks:status'),
    install: invoke('hooks:install'),
    uninstall: invoke('hooks:uninstall'),
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
