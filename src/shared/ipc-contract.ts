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

  // Resposta ao evento `app:closeRequested`: o renderer terminou de salvar e o app pode fechar.
  'app:confirmClose': { args: []; result: void }
}

export interface EventChannels {
  'fs:changed': FsChangedEvent
  'pty:data': PtyDataEvent
  'pty:exit': PtyExitEvent
  'app:closeRequested': Record<string, never>
  'git:changed': GitChangedEvent
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
