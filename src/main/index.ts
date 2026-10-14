import { join } from 'node:path'
import { subscribe } from '@parcel/watcher'
import { Octokit } from '@octokit/rest'
import { app, BrowserWindow, clipboard, dialog, Notification, safeStorage, shell } from 'electron'
import { spawn as spawnPty } from 'node-pty'
import { z } from 'zod'
import type { EventChannel, EventChannels } from '@shared/ipc-contract'
import type { AgentTask } from '@shared/types'
import { registerAgentIpc } from './ipc/agent.ipc'
import { registerAppIpc } from './ipc/app.ipc'
import { registerDialogIpc } from './ipc/dialog.ipc'
import { registerFsIpc } from './ipc/fs.ipc'
import { registerGitIpc } from './ipc/git.ipc'
import { registerGitHubIpc } from './ipc/github.ipc'
import { registerSystemIpc } from './ipc/system.ipc'
import { registerTerminalIpc } from './ipc/terminal.ipc'
import { registerWorkspaceIpc } from './ipc/workspace.ipc'
import { JsonStore } from './lib/json-store'
import { agentStateSchema } from './lib/agent-schemas'
import { createGitRunner } from './lib/git-runner'
import { logger } from './lib/logger'
import { TokenStore } from './lib/token-store'
import { defaultShell, type ShellSpec } from './lib/shell'
import { listShells, which } from './lib/which'
import { WorkspaceGuard } from './lib/workspace-guard'
import { installMenu } from './menu'
import { AgentService, type AgentState } from './services/agent.service'
import { AppService } from './services/app.service'
import { FsService } from './services/fs.service'
import { GitWatchService } from './services/git-watch.service'
import { GitService } from './services/git.service'
import { GitHubAuthService } from './services/github-auth.service'
import { fetchGitHubUser, GitHubService } from './services/github.service'
import { PtyService } from './services/pty.service'
import { TerminalSessionService } from './services/terminal-session.service'
import { WatchService } from './services/watch.service'
import { WorkspaceService, type WorkspaceState } from './services/workspace.service'

const log = logger
let mainWindow: BrowserWindow | null = null
let closeConfirmed = false
let quitting = false

function emit<E extends EventChannel>(channel: E, payload: EventChannels[E]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: '#0f1115',
    title: 'AiController',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Links externos abrem no navegador do sistema; nenhuma janela nova dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Impede navegação para fora do bundle do renderer.
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    event.preventDefault()
  })

  if (!app.isPackaged) {
    win.webContents.on('console-message', (details) => {
      log.child('renderer').debug(details.message, { level: details.level })
    })
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

const AGENT_MESSAGES: Record<string, (name: string, code: number | null) => [string, string]> = {
  waiting: (name) => [
    `${name} está aguardando você`,
    'O agente parou e parece esperar uma resposta.',
  ],
  done: (name) => [`${name} terminou`, 'Use "Revisar" para ver as alterações.'],
  error: (name, code) => [
    `${name} falhou`,
    code === null ? 'O agente foi interrompido.' : `Saiu com código ${code}.`,
  ],
}

// Notificação nativa; clicar traz a janela e foca a tarefa.
function notifyAgent(task: AgentTask): void {
  const message = AGENT_MESSAGES[task.status]
  if (!message || !Notification.isSupported()) return
  const [title, body] = message(task.name, task.exitCode)
  const notification = new Notification({ title, body })
  notification.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    emit('agent:focus', { id: task.id })
  })
  notification.show()
}

function createServices() {
  const guard = new WorkspaceGuard()
  const appService = new AppService({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
  })
  const fsService = new FsService({ guard, trash: (p) => shell.trashItem(p) })
  const watchService = new WatchService({
    guard,
    subscribe,
    emit: (event) => emit('fs:changed', event),
    onGitignoreChanged: (file) => fsService.invalidateIgnore(file),
    log: log.child('watch'),
  })
  const gitService = new GitService({ guard, run: createGitRunner() })
  const gitWatchService = new GitWatchService({
    gitDirs: (root) => gitService.gitDirs(root),
    subscribe,
    emit: (event) => emit('git:changed', event),
    log: log.child('git-watch'),
  })
  // URLs configuráveis: GitHub Enterprise e servidor falso nos testes e2e.
  const githubApiUrl = process.env['GITHUB_API_URL'] ?? 'https://api.github.com'
  const octokit = (token: string) =>
    new Octokit({
      auth: token,
      baseUrl: githubApiUrl,
      userAgent: `AiController/${app.getVersion()}`,
    })
  const githubAuth = new GitHubAuthService({
    clientId: process.env['GITHUB_CLIENT_ID'] || undefined,
    oauthUrl: process.env['GITHUB_OAUTH_URL'] ?? 'https://github.com',
    fetch: (input, init) => fetch(input, init),
    tokens: new TokenStore(join(app.getPath('userData'), 'github-token.bin'), {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (s) => safeStorage.encryptString(s),
      decryptString: (b) => safeStorage.decryptString(b),
      backend: () =>
        process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : null,
    }),
    fetchUser: (token) => fetchGitHubUser(octokit(token)),
  })
  const githubService = new GitHubService({
    getToken: () => githubAuth.getToken(),
    octokit,
    git: gitService,
    host: process.env['GITHUB_HOST'] ?? 'github.com',
  })
  const workspaceService = new WorkspaceService({
    guard,
    store: new JsonStore<WorkspaceState>(
      join(app.getPath('userData'), 'workspace.json'),
      z.object({ recent: z.array(z.string()) }),
      { recent: [] },
    ),
    pickFolder: async () => {
      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory'],
      }
      const res = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options)
      return res.canceled ? null : (res.filePaths[0] ?? null)
    },
    onRootClosed: async (root) => {
      await Promise.all([watchService.unwatch(root), gitWatchService.unwatch(root)])
    },
    isKnownWorktree: async (dir) => {
      for (const root of guard.getRoots()) {
        if (await gitService.isWorktreeOf(root, dir).catch(() => false)) return true
      }
      return false
    },
  })
  // A saída e o fim dos PTYs vão para o renderer e também para o AgentService (status).
  let agents: AgentService | null = null
  const shellSpec: ShellSpec = defaultShell({
    platform: process.platform,
    env: process.env,
    which: (n) => which(n),
  })
  const ptyService = new PtyService({
    guard,
    spawn: spawnPty,
    shell: shellSpec,
    allowedShells: async () => listShells(),
    baseEnv: process.env,
    emitData: (event) => {
      emit('pty:data', event)
      agents?.onPtyData(event)
    },
    emitExit: (event) => {
      emit('pty:exit', event)
      agents?.onPtyExit(event)
    },
    log: log.child('pty'),
  })
  const sessionService = new TerminalSessionService(
    guard,
    join(app.getPath('userData'), 'terminal-sessions'),
  )
  agents = new AgentService({
    git: gitService,
    pty: ptyService,
    shell: shellSpec,
    platform: process.platform,
    store: new JsonStore<AgentState>(
      join(app.getPath('userData'), 'agents.json'),
      agentStateSchema,
      {
        presets: [],
        tasks: [],
      },
    ),
    emit: (task) => emit('agent:status', task),
    notify: notifyAgent,
  })
  const agentService = agents
  return {
    agentService,
    appService,
    fsService,
    watchService,
    workspaceService,
    ptyService,
    sessionService,
    gitService,
    gitWatchService,
    githubAuth,
    githubService,
  }
}

// Permite isolar o perfil (recentes etc.), usado pelos testes e2e.
const userDataOverride = process.env['AIC_USER_DATA_DIR']
if (userDataOverride) app.setPath('userData', userDataOverride)

void app.whenReady().then(() => {
  installMenu()
  const services = createServices()
  const ipcLog = log.child('ipc')
  registerAppIpc(services.appService, ipcLog)
  registerWorkspaceIpc(services.workspaceService, ipcLog)
  registerFsIpc(services.fsService, services.watchService, ipcLog)
  registerDialogIpc(async (o) => {
    const box = {
      type: o.kind ?? 'question',
      message: o.message,
      detail: o.detail,
      buttons: o.buttons,
      defaultId: 0,
      cancelId: o.buttons.length - 1,
      noLink: true,
    }
    const res = mainWindow
      ? await dialog.showMessageBox(mainWindow, box)
      : await dialog.showMessageBox(box)
    return res.response
  }, ipcLog)

  registerTerminalIpc(services.ptyService, services.sessionService, ipcLog)
  registerGitIpc(services.gitService, services.gitWatchService, ipcLog)
  registerGitHubIpc(services.githubAuth, services.githubService, ipcLog)
  registerAgentIpc(services.agentService, ipcLog)
  void services.agentService.init()
  const agentTicker = setInterval(() => services.agentService.tick(), 500)
  registerSystemIpc(
    {
      readClipboard: () => clipboard.readText(),
      writeClipboard: (text) => clipboard.writeText(text),
      confirmClose: async () => {
        // Salva o estado dos agentes antes que o processo termine.
        await services.agentService.shutdown()
        closeConfirmed = true
        if (quitting) app.quit()
        else mainWindow?.close()
      },
    },
    ipcLog,
  )

  const open = (): void => {
    closeConfirmed = false
    const win = createWindow()
    mainWindow = win
    // Antes de fechar, o renderer salva os terminais e pergunta sobre arquivos não salvos.
    // Ele responde com `app:confirmClose`; se não puder (travado), fecha direto.
    win.on('close', (event) => {
      if (closeConfirmed || win.webContents.isCrashed() || win.webContents.isLoading()) return
      event.preventDefault()
      win.webContents.send('app:closeRequested', {})
    })
    win.on('closed', () => {
      mainWindow = null
      clearInterval(agentTicker)
      void services.agentService.shutdown()
      services.ptyService.killAll()
      void services.watchService.unwatchAll()
      void services.gitWatchService.unwatchAll()
    })
  }
  open()
  log.info('janela criada')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open()
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
