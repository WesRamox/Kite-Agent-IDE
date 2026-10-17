import { homedir } from 'node:os'
import { join } from 'node:path'
import { subscribe } from '@parcel/watcher'
import { Octokit } from '@octokit/rest'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  nativeTheme,
  Notification,
  safeStorage,
  shell,
} from 'electron'
import { spawn as spawnPty } from 'node-pty'
import { z } from 'zod'
import type { EventChannel, EventChannels } from '@shared/ipc-contract'
import { DEFAULT_THEME, themeInfo, type ThemeId } from '@shared/themes'
import type { AgentCli, AgentSession, AgentTask, AppSettings } from '@shared/types'
import { registerAgentIpc } from './ipc/agent.ipc'
import { registerAgentSessionIpc } from './ipc/agent-session.ipc'
import { registerAppIpc } from './ipc/app.ipc'
import { registerDialogIpc } from './ipc/dialog.ipc'
import { registerFsIpc } from './ipc/fs.ipc'
import { registerGitIpc } from './ipc/git.ipc'
import { registerGitHubIpc } from './ipc/github.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerSystemIpc } from './ipc/system.ipc'
import { registerTaskIpc } from './ipc/task.ipc'
import { registerReviewIpc } from './ipc/review.ipc'
import { registerTerminalIpc } from './ipc/terminal.ipc'
import { registerWorkspaceIpc } from './ipc/workspace.ipc'
import { JsonStore } from './lib/json-store'
import { DEFAULT_SETTINGS, settingsSchema } from './lib/settings-schema'
import { loadEnvFiles } from './lib/env-file'
import { agentStateSchema } from './lib/agent-schemas'
import { HOOK_TARGETS, wrapperScript } from './lib/claude-settings'
import { createGitRunner } from './lib/git-runner'
import { migrateLegacyProfile } from './lib/legacy-profile'
import { logger } from './lib/logger'
import { TokenStore } from './lib/token-store'
import { defaultShell, type ShellSpec } from './lib/shell'
import { listShells, which } from './lib/which'
import { WorkspaceGuard } from './lib/workspace-guard'
import { installMenu } from './menu'
import { AgentEventService } from './services/agent-events.service'
import { AgentService, type AgentState } from './services/agent.service'
import { HooksService } from './services/hooks.service'
import { AppService } from './services/app.service'
import { FsService } from './services/fs.service'
import { GitWatchService } from './services/git-watch.service'
import { GitService } from './services/git.service'
import { GitHubAuthService } from './services/github-auth.service'
import { fetchGitHubUser, GitHubService } from './services/github.service'
import { PtyService } from './services/pty.service'
import { SettingsService } from './services/settings.service'
import { TaskService, taskStateSchema, type TaskState } from './services/task.service'
import { TaskReviewService } from './services/task-review.service'
import { TerminalSessionService } from './services/terminal-session.service'
import { WatchService } from './services/watch.service'
import { WorkspaceService, type WorkspaceState } from './services/workspace.service'

const log = logger
let mainWindow: BrowserWindow | null = null
let closeConfirmed = false
let currentTheme: ThemeId = DEFAULT_THEME
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
    backgroundColor: themeInfo(currentTheme).background,
    title: 'Kite',
    // Em dev/build local; no pacote final o ícone vem do instalador.
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // DevTools desligado; só em dev, com KITE_DEVTOOLS=1, para depurar o renderer.
      devTools: !app.isPackaged && process.env['KITE_DEVTOOLS'] === '1',
    },
    autoHideMenuBar: true,
  })

  if (process.platform !== 'darwin') win.removeMenu()

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

// Configurações em uso (para as notificações, que nascem fora dos serviços).
let settingsRef: SettingsService | null = null
const notificationsOn = () => settingsRef?.get().notifications ?? true

// Notificação nativa; clicar traz a janela e foca a tarefa.
function notifyAgent(task: AgentTask): void {
  const message = AGENT_MESSAGES[task.status]
  if (!message || !notificationsOn() || !Notification.isSupported()) return
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

const CLI_NAME: Record<AgentCli, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }

const SESSION_MESSAGES: Record<string, (s: AgentSession) => [string, string]> = {
  permission: (s) => [
    `${CLI_NAME[s.cli]} pede permissão`,
    s.pending ? `${s.pending.tool}: ${s.pending.detail}`.trim() : (s.lastMessage ?? ''),
  ],
  turn: (s) => [`${CLI_NAME[s.cli]} terminou e espera você`, s.lastMessage ?? ''],
  input: (s) => [`${CLI_NAME[s.cli]} precisa de uma resposta`, s.lastMessage ?? ''],
}

// Notificação de uma sessão vista pelos hooks (agente dentro ou fora do Kite).
function notifySession(session: AgentSession): void {
  const message = session.waitReason ? SESSION_MESSAGES[session.waitReason] : undefined
  if (!message || !notificationsOn() || !Notification.isSupported()) return
  const [title, body] = message(session)
  const notification = new Notification({ title, body: body.slice(0, 180) })
  notification.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    emit('agentSession:focus', { id: session.id })
  })
  notification.show()
}

function createServices() {
  const guard = new WorkspaceGuard()
  const settingsService = new SettingsService({
    store: new JsonStore<AppSettings>(
      join(app.getPath('userData'), 'settings.json'),
      settingsSchema,
      DEFAULT_SETTINGS,
    ),
    applyTheme: applyNativeTheme,
  })
  settingsRef = settingsService
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
      userAgent: `Kite/${app.getVersion()}`,
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
  const pickFolder = async (): Promise<string | null> => {
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
    const res = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  }
  const taskService = new TaskService({
    guard,
    run: createGitRunner(),
    store: new JsonStore<TaskState>(join(app.getPath('userData'), 'tasks.json'), taskStateSchema, {
      workspaces: {},
    }),
    subscribe,
    emit: (tasks) => emit('task:changed', tasks),
    pickFolder,
    log: log.child('tasks'),
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
      await Promise.all([
        watchService.unwatch(root),
        gitWatchService.unwatch(root),
        taskService.unwatch(),
      ])
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
  // Hooks do Claude Code (Fase 6). KITE_CLAUDE_SETTINGS isola o settings.json nos testes.
  const spoolDir = join(app.getPath('userData'), 'agent-events')
  // Um serviço por CLI (Claude Code, Codex, Gemini), todos com o mesmo kite-hook.sh.
  // KITE_CLAUDE_SETTINGS / KITE_CODEX_HOOKS / KITE_GEMINI_SETTINGS isolam os arquivos nos testes.
  const wrapperPath = join(app.getPath('userData'), 'kite-hook.sh')
  const wrapperContent = wrapperScript(process.execPath, join(__dirname, 'kite-hook.js'), spoolDir)
  const overrides: Record<AgentCli, string | undefined> = {
    claude: process.env['KITE_CLAUDE_SETTINGS'],
    codex: process.env['KITE_CODEX_HOOKS'],
    gemini: process.env['KITE_GEMINI_SETTINGS'],
  }
  const hooksServices = Object.fromEntries(
    (Object.keys(HOOK_TARGETS) as AgentCli[]).map((cli) => [
      cli,
      new HooksService({
        target: HOOK_TARGETS[cli],
        settingsPath: overrides[cli] ?? join(homedir(), ...HOOK_TARGETS[cli].file),
        wrapperPath,
        wrapperContent,
        home: homedir(),
        log: log.child('hooks'),
      }),
    ]),
  ) as Record<AgentCli, HooksService>
  const agentEvents = new AgentEventService({
    spoolDir,
    subscribe,
    emit: (session) => emit('agentSession:changed', session),
    onWaiting: notifySession,
    isLiveAgent: (id) => agentService.isLive(id),
    onAgentStatus: (id, status) => agentService.applyHookStatus(id, status),
    log: log.child('agent-events'),
  })
  const reviewService = new TaskReviewService({
    tasks: taskService,
    git: gitService,
    github: githubService,
    log: log.child('review'),
  })
  return {
    reviewService,
    taskService,
    hooksServices,
    agentEvents,
    settingsService,
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

// O nome do app (productName) é Kite. Permite isolar o perfil, usado pelos testes e2e.
app.setName('Kite')
const userDataOverride = process.env['KITE_USER_DATA_DIR']
if (userDataOverride) app.setPath('userData', userDataOverride)
else {
  const copied = migrateLegacyProfile(app.getPath('appData'), app.getPath('userData'))
  if (copied.length > 0) log.info('perfil do AiController migrado', { files: copied })
}

// .env com a configuração do app: o da pasta do projeto em `pnpm dev` e o da pasta de perfil
// (vale também no app empacotado). Loga só os nomes das chaves, nunca os valores.
{
  const envFiles = [join(app.getPath('userData'), '.env')]
  if (!app.isPackaged) envFiles.unshift(join(app.getAppPath(), '.env'))
  const env = loadEnvFiles(envFiles, process.env)
  if (env.keys.length > 0) log.info('configuração lida do .env', env)
}

// Tema fora do renderer: fundo das janelas e diálogos/menus nativos claros ou escuros.
function applyNativeTheme(theme: ThemeId): void {
  currentTheme = theme
  const info = themeInfo(theme)
  nativeTheme.themeSource = info.kind
  for (const win of BrowserWindow.getAllWindows()) win.setBackgroundColor(info.background)
}

void app.whenReady().then(async () => {
  installMenu()
  const services = createServices()
  await services.settingsService.init()
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
  registerAgentIpc(services.agentService, services.taskService, ipcLog)
  registerAgentSessionIpc(services.agentEvents, services.hooksServices, ipcLog)
  registerTaskIpc(services.taskService, ipcLog)
  registerReviewIpc(services.reviewService, ipcLog)
  services.hooksServices.claude.ensureWrapper().catch((err: unknown) => {
    log.warn('não foi possível criar o kite-hook.sh', { error: (err as Error).message })
  })
  services.agentEvents.init().catch((err: unknown) => {
    log.warn('não foi possível ler o spool de agentes', { error: (err as Error).message })
  })
  registerSettingsIpc(services.settingsService, ipcLog)
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
      void services.agentEvents.dispose()
      void services.taskService.unwatch()
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
