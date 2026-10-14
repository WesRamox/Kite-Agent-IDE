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
  GitBranch,
  GitChangedEvent,
  GitDiff,
  GitStatus,
  GitWorktree,
  CreatePullInput,
  AgentAttach,
  AgentPreset,
  AgentReview,
  AgentTask,
  StartAgentInput,
  DeviceFlowPoll,
  DeviceFlowStart,
  GitHubAuthState,
  GitHubItemState,
  GitHubRepoRef,
  IssueDetail,
  IssueSummary,
  PullDetail,
  PullSummary,
  PtyCreateOptions,
  PtyDataEvent,
  PtyExitEvent,
  Result,
  TerminalSession,
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

  'pty:create': { args: [options: PtyCreateOptions]; result: { id: string; pid: number } }
  'pty:write': { args: [id: string, data: string]; result: void }
  'pty:resize': { args: [id: string, cols: number, rows: number]; result: void }
  'pty:kill': { args: [id: string]; result: void }

  'terminal:loadSessions': { args: [root: string]; result: TerminalSession[] }
  'terminal:saveSessions': { args: [root: string, sessions: TerminalSession[]]; result: void }

  'clipboard:readText': { args: []; result: string }
  'clipboard:writeText': { args: [text: string]; result: void }

  'workspace:openWorktree': { args: [path: string]; result: string }

  'git:status': { args: [root: string]; result: GitStatus }
  'git:diff': { args: [root: string, path: string, staged: boolean]; result: GitDiff }
  'git:stage': { args: [root: string, paths: string[]]; result: void }
  'git:unstage': { args: [root: string, paths: string[]]; result: void }
  'git:commit': { args: [root: string, message: string]; result: { hash: string } }
  'git:branches': { args: [root: string]; result: GitBranch[] }
  'git:checkout': { args: [root: string, branch: string, create: boolean]; result: void }
  'git:worktreeList': { args: [root: string]; result: GitWorktree[] }
  'git:worktreeAdd': {
    args: [root: string, branch: string, createBranch: boolean]
    result: { path: string }
  }
  'git:worktreeRemove': { args: [root: string, path: string, force: boolean]; result: void }
  'git:watch': { args: [root: string]; result: void }
  'git:unwatch': { args: [root: string]; result: void }

  'github:me': { args: []; result: GitHubAuthState }
  'github:startDeviceFlow': { args: []; result: DeviceFlowStart }
  'github:pollDeviceFlow': { args: [flowId: string]; result: DeviceFlowPoll }
  'github:logout': { args: []; result: void }
  'github:repo': { args: [root: string]; result: GitHubRepoRef | null }
  'github:listPRs': { args: [root: string, state: GitHubItemState]; result: PullSummary[] }
  'github:listIssues': { args: [root: string, state: GitHubItemState]; result: IssueSummary[] }
  'github:getPR': { args: [root: string, number: number]; result: PullDetail }
  'github:getIssue': { args: [root: string, number: number]; result: IssueDetail }
  'github:createPR': {
    args: [root: string, input: CreatePullInput]
    result: { number: number; url: string }
  }
  // Busca a branch do PR e cria (ou reaproveita) uma worktree para ele.
  'github:checkoutPR': {
    args: [root: string, number: number]
    result: { path: string; branch: string }
  }

  'agent:presets': { args: []; result: AgentPreset[] }
  'agent:savePresets': { args: [presets: AgentPreset[]]; result: AgentPreset[] }
  'agent:list': { args: []; result: AgentTask[] }
  'agent:start': { args: [input: StartAgentInput]; result: AgentTask }
  'agent:stop': { args: [id: string]; result: void }
  'agent:restart': { args: [id: string]; result: AgentTask }
  'agent:remove': { args: [id: string, removeWorktree: boolean]; result: void }
  'agent:attach': { args: [id: string]; result: AgentAttach }
  'agent:review': { args: [id: string]; result: AgentReview }
  'agent:reviewDiff': { args: [id: string, path: string]; result: GitDiff }

  // Resposta ao evento `app:closeRequested`: o renderer terminou de salvar e o app pode fechar.
  'app:confirmClose': { args: []; result: void }
}

export interface EventChannels {
  'fs:changed': FsChangedEvent
  'pty:data': PtyDataEvent
  'pty:exit': PtyExitEvent
  'app:closeRequested': Record<string, never>
  'git:changed': GitChangedEvent
  // Tarefa criada ou alterada (status, fim do processo...). Removida: `removed: true`.
  'agent:status': AgentTask & { removed?: boolean }
  // Clique na notificação de um agente.
  'agent:focus': { id: string }
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
    confirmClose: Fn<'app:confirmClose'>
    onCloseRequested: (listener: () => void) => Unsubscribe
  }
  clipboard: {
    readText: Fn<'clipboard:readText'>
    writeText: Fn<'clipboard:writeText'>
  }
  agent: {
    presets: Fn<'agent:presets'>
    savePresets: Fn<'agent:savePresets'>
    list: Fn<'agent:list'>
    start: Fn<'agent:start'>
    stop: Fn<'agent:stop'>
    restart: Fn<'agent:restart'>
    remove: Fn<'agent:remove'>
    attach: Fn<'agent:attach'>
    review: Fn<'agent:review'>
    reviewDiff: Fn<'agent:reviewDiff'>
    onStatus: (listener: (task: AgentTask & { removed?: boolean }) => void) => Unsubscribe
    onFocus: (listener: (event: { id: string }) => void) => Unsubscribe
  }
  github: {
    me: Fn<'github:me'>
    startDeviceFlow: Fn<'github:startDeviceFlow'>
    pollDeviceFlow: Fn<'github:pollDeviceFlow'>
    logout: Fn<'github:logout'>
    repo: Fn<'github:repo'>
    listPRs: Fn<'github:listPRs'>
    listIssues: Fn<'github:listIssues'>
    getPR: Fn<'github:getPR'>
    getIssue: Fn<'github:getIssue'>
    createPR: Fn<'github:createPR'>
    checkoutPR: Fn<'github:checkoutPR'>
  }
  pty: {
    create: Fn<'pty:create'>
    write: Fn<'pty:write'>
    resize: Fn<'pty:resize'>
    kill: Fn<'pty:kill'>
    onData: (listener: (event: PtyDataEvent) => void) => Unsubscribe
    onExit: (listener: (event: PtyExitEvent) => void) => Unsubscribe
  }
  terminal: {
    loadSessions: Fn<'terminal:loadSessions'>
    saveSessions: Fn<'terminal:saveSessions'>
  }
  dialog: {
    confirm: Fn<'dialog:confirm'>
  }
  workspace: {
    openFolderDialog: Fn<'fs:openFolderDialog'>
    openRecent: Fn<'workspace:openRecent'>
    recent: Fn<'workspace:recent'>
    removeRecent: Fn<'workspace:removeRecent'>
    openWorktree: Fn<'workspace:openWorktree'>
  }
  git: {
    status: Fn<'git:status'>
    diff: Fn<'git:diff'>
    stage: Fn<'git:stage'>
    unstage: Fn<'git:unstage'>
    commit: Fn<'git:commit'>
    branches: Fn<'git:branches'>
    checkout: Fn<'git:checkout'>
    worktreeList: Fn<'git:worktreeList'>
    worktreeAdd: Fn<'git:worktreeAdd'>
    worktreeRemove: Fn<'git:worktreeRemove'>
    watch: Fn<'git:watch'>
    unwatch: Fn<'git:unwatch'>
    onChanged: (listener: (event: GitChangedEvent) => void) => Unsubscribe
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
