// Fonte única de verdade de todos os canais IPC.
// Request/response: nome `dominio:acao`, via ipcMain.handle / ipcRenderer.invoke.
// Eventos main → renderer: nome `dominio:evento`, via webContents.send.
// Os canais de cada domínio entram aqui na fase em que o domínio é implementado.

import type { ThemeId } from './themes'
import type {
  AppInfo,
  AppSettings,
  SettingsPatch,
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
  AgentCli,
  AgentPreset,
  AgentReview,
  AgentSession,
  AgentTask,
  HooksStatus,
  Task,
  TaskGrouping,
  CreateTaskInput,
  TaskChangesRepo,
  TaskReview,
  DeliverInput,
  DeliverResult,
  WorkspaceTasks,
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

  'settings:get': { args: []; result: AppSettings }
  'settings:setTheme': { args: [theme: ThemeId]; result: AppSettings }
  'settings:update': { args: [patch: SettingsPatch]; result: AppSettings }

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
  // Sessões vistas pelos hooks dos CLIs (Fase 6).
  'agentSession:list': { args: []; result: AgentSession[] }
  'agentSession:review': { args: [id: string]; result: AgentReview }
  'agentSession:reviewDiff': { args: [id: string, path: string]; result: GitDiff }
  'agentSession:pending': { args: [ids: string[]]; result: Record<string, number> }
  'review:dismissed': { args: []; result: string[] }
  'review:dismiss': { args: [key: string]; result: string[] }
  'hooks:status': { args: [cli: AgentCli]; result: HooksStatus }
  'hooks:install': { args: [cli: AgentCli]; result: HooksStatus }
  'hooks:uninstall': { args: [cli: AgentCli]; result: HooksStatus }
  // Tarefas multi-repo (Fase 8). `root` é a pasta aberta.
  'task:discover': { args: [root: string]; result: WorkspaceTasks }
  'task:watch': { args: [root: string]; result: void }
  'task:setGrouping': { args: [root: string, grouping: TaskGrouping]; result: WorkspaceTasks }
  'task:rename': { args: [root: string, taskId: string, name: string]; result: WorkspaceTasks }
  'task:move': { args: [root: string, worktree: string, target: string]; result: WorkspaceTasks }
  'task:ignore': { args: [root: string, worktree: string]; result: WorkspaceTasks }
  'task:import': { args: [root: string, hidden: string[]]; result: WorkspaceTasks }
  'task:setHidden': {
    args: [root: string, taskId: string, hidden: boolean]
    result: WorkspaceTasks
  }
  'task:setNotes': { args: [root: string, taskId: string, notes: string]; result: WorkspaceTasks }
  'task:linkSession': {
    args: [root: string, sessionId: string, taskId: string | null]
    result: WorkspaceTasks
  }
  'task:addExternalRepo': { args: [root: string]; result: WorkspaceTasks }
  'task:removeRepo': { args: [root: string, repo: string]; result: WorkspaceTasks }
  'task:restoreRepo': { args: [root: string, repo: string]; result: WorkspaceTasks }
  'task:remove': { args: [root: string, taskId: string]; result: WorkspaceTasks }
  'task:openRepo': { args: [root: string, repo: string]; result: string }
  'task:open': { args: [root: string, taskId: string]; result: Task }
  'task:addRepo': { args: [root: string, taskId: string, repo: string]; result: WorkspaceTasks }
  // Nova tarefa e agente na pasta dela (Fase 10).
  'task:create': { args: [root: string, input: CreateTaskInput]; result: Task }
  'agent:startInTask': {
    args: [root: string, taskId: string, presetId: string, prompt: string]
    result: AgentTask
  }
  // Revisão e entrega da tarefa (Fase 9). `bases`: branch base escolhida por worktree.
  'review:task': {
    args: [root: string, taskId: string, bases: Record<string, string>]
    result: TaskReview
  }
  'review:diff': {
    args: [root: string, taskId: string, worktree: string, base: string, rel: string]
    result: GitDiff
  }
  'review:changes': { args: [root: string, taskId: string]; result: TaskChangesRepo[] }
  'review:prs': { args: [root: string, taskId: string]; result: Record<string, PullSummary | null> }
  'review:deliver': {
    args: [root: string, taskId: string, input: DeliverInput]
    result: DeliverResult[]
  }

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
  'agentSession:changed': AgentSession
  // Clique na notificação de uma sessão.
  'agentSession:focus': { id: string }
  // Worktrees mudaram (criadas, removidas ou trocando de branch) no workspace observado.
  'task:changed': WorkspaceTasks
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
  settings: {
    get: Fn<'settings:get'>
    setTheme: Fn<'settings:setTheme'>
    update: Fn<'settings:update'>
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
    startInTask: Fn<'agent:startInTask'>
    onStatus: (listener: (task: AgentTask & { removed?: boolean }) => void) => Unsubscribe
    onFocus: (listener: (event: { id: string }) => void) => Unsubscribe
  }
  agentSession: {
    list: Fn<'agentSession:list'>
    review: Fn<'agentSession:review'>
    reviewDiff: Fn<'agentSession:reviewDiff'>
    pending: Fn<'agentSession:pending'>
    dismissed: Fn<'review:dismissed'>
    dismiss: Fn<'review:dismiss'>
    onChanged: (listener: (session: AgentSession) => void) => Unsubscribe
    onFocus: (listener: (event: { id: string }) => void) => Unsubscribe
  }
  task: {
    discover: Fn<'task:discover'>
    watch: Fn<'task:watch'>
    setGrouping: Fn<'task:setGrouping'>
    rename: Fn<'task:rename'>
    move: Fn<'task:move'>
    ignore: Fn<'task:ignore'>
    import: Fn<'task:import'>
    setHidden: Fn<'task:setHidden'>
    setNotes: Fn<'task:setNotes'>
    linkSession: Fn<'task:linkSession'>
    addExternalRepo: Fn<'task:addExternalRepo'>
    removeRepo: Fn<'task:removeRepo'>
    restoreRepo: Fn<'task:restoreRepo'>
    remove: Fn<'task:remove'>
    openRepo: Fn<'task:openRepo'>
    open: Fn<'task:open'>
    addRepo: Fn<'task:addRepo'>
    create: Fn<'task:create'>
    onChanged: (listener: (tasks: WorkspaceTasks) => void) => Unsubscribe
  }
  review: {
    task: Fn<'review:task'>
    changes: Fn<'review:changes'>
    diff: Fn<'review:diff'>
    prs: Fn<'review:prs'>
    deliver: Fn<'review:deliver'>
  }
  hooks: {
    status: Fn<'hooks:status'>
    install: Fn<'hooks:install'>
    uninstall: Fn<'hooks:uninstall'>
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
