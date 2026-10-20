import { homedir } from 'node:os'
import { join } from 'node:path'
import { subscribe } from '@parcel/watcher'
import { Octokit } from '@octokit/rest'
import { app, dialog, safeStorage, shell } from 'electron'
import { spawn as spawnPty } from 'node-pty'
import { z } from 'zod'
import { languageFor } from '@shared/i18n'
import type { AgentCli, AgentPreset, AppSettings } from '@shared/types'
import { agentStateSchema } from '../lib/agent-schemas'
import { HOOK_TARGETS, wrapperScript } from '../lib/claude-settings'
import { createGitRunner } from '../lib/git-runner'
import { setLanguage } from '../lib/i18n'
import { canvasStoreSchema, type CanvasStore } from '../lib/canvas-schema'
import { JsonStore } from '../lib/json-store'
import { logger } from '../lib/logger'
import { DEFAULT_SETTINGS, settingsSchemaWith } from '../lib/settings-schema'
import { defaultShell, type ShellSpec } from '../lib/shell'
import { TokenStore } from '../lib/token-store'
import { listShells, which } from '../lib/which'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { installMenu } from '../menu'
import { AgentEventService } from '../services/agent-events.service'
import { AgentService, type AgentState } from '../services/agent.service'
import { AppService } from '../services/app.service'
import { CanvasBridgeService, canvasSocketPath } from '../services/canvas-bridge.service'
import { CanvasService } from '../services/canvas.service'
import { FsService } from '../services/fs.service'
import { GitWatchService } from '../services/git-watch.service'
import { GitReviewService } from '../services/git-review.service'
import { GitService } from '../services/git.service'
import { GitHubAuthService } from '../services/github-auth.service'
import { fetchGitHubUser, GitHubService } from '../services/github.service'
import { HooksService } from '../services/hooks.service'
import { PtyService } from '../services/pty.service'
import {
  SessionReviewService,
  reviewStateSchema,
  type ReviewState,
} from '../services/session-review.service'
import { SettingsService } from '../services/settings.service'
import { TaskReviewService } from '../services/task-review.service'
import { TaskService, taskStateSchema, type TaskState } from '../services/task.service'
import { TerminalSessionService } from '../services/terminal-session.service'
import { WatchService } from '../services/watch.service'
import { WorkspaceService, type WorkspaceState } from '../services/workspace.service'
import { hookBundle } from './hook-bundle'
import type { MainWindowRef } from './main-window'
import type { NativeTheme } from './native-theme'
import { createNotifier } from './notifications'

const log = logger

export interface ContainerDeps {
  window: MainWindowRef
  theme: NativeTheme
}

// GITHUB_CLIENT_ID (ambiente ou .env) vence o embutido no build; definida vazia, desliga o login
// (os e2e testam assim o caso sem configuração).
function githubClientId(): string | undefined {
  const fromEnv = process.env['GITHUB_CLIENT_ID']
  if (fromEnv !== undefined) return fromEnv || undefined
  return __KITE_GITHUB_CLIENT_ID__ || undefined
}

// Cria todos os serviços do main com as dependências reais (Electron, disco, rede).
export function createServices(deps: ContainerDeps) {
  const { window, theme } = deps
  const guard = new WorkspaceGuard()
  // Idioma padrão: o do sistema (português para pt-*, inglês para o resto).
  const defaults: AppSettings = { ...DEFAULT_SETTINGS, language: languageFor(app.getLocale()) }
  const settingsService = new SettingsService({
    store: new JsonStore<AppSettings>(
      join(app.getPath('userData'), 'settings.json'),
      settingsSchemaWith(defaults),
      defaults,
    ),
    applyTheme: (t) => theme.apply(t),
    applyLanguage: (lang) => {
      setLanguage(lang)
      installMenu()
    },
    defaults,
  })
  const notifier = createNotifier({
    window,
    enabled: () => settingsService.get().notifications,
  })
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
    emit: (event) => window.emit('fs:changed', event),
    onGitignoreChanged: (file) => fsService.invalidateIgnore(file),
    log: log.child('watch'),
  })
  const gitService = new GitService({ guard, run: createGitRunner() })
  const gitReview = new GitReviewService({ run: createGitRunner() })
  const gitWatchService = new GitWatchService({
    gitDirs: (root) => gitService.gitDirs(root),
    subscribe,
    emit: (event) => window.emit('git:changed', event),
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
    clientId: githubClientId(),
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
    const res = window.current
      ? await dialog.showOpenDialog(window.current, options)
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
    emit: (tasks) => window.emit('task:changed', tasks),
    pickFolder,
    log: log.child('tasks'),
  })
  const canvasService = new CanvasService({
    guard,
    store: new JsonStore<CanvasStore>(
      join(app.getPath('userData'), 'canvas.json'),
      canvasStoreSchema,
      { workspaces: {} },
    ),
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
      const res = window.current
        ? await dialog.showOpenDialog(window.current, options)
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
      window.emit('pty:data', event)
      agents?.onPtyData(event)
    },
    emitExit: (event) => {
      window.emit('pty:exit', event)
      agents?.onPtyExit(event)
    },
    log: log.child('pty'),
  })
  const sessionService = new TerminalSessionService(
    guard,
    join(app.getPath('userData'), 'terminal-sessions'),
  )
  const hook = hookBundle(log)
  const canvasBridge = new CanvasBridgeService({
    socketPath: canvasSocketPath(app.getPath('userData'), process.platform),
    configDir: join(app.getPath('userData'), 'mcp'),
    server: { exec: hook.exec, script: hook.mcp },
    platform: process.platform,
    presets: async (): Promise<AgentPreset[]> => agents?.presets() ?? [],
    emit: (call) => window.emit('canvas:toolCall', call),
    log: log.child('canvas-tools'),
  })
  agents = new AgentService({
    git: gitService,
    review: gitReview,
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
    emit: (task) => window.emit('agent:status', task),
    notify: (task) => notifier.agent(task),
    // Sem a configuração, o agente só não ganha as ferramentas do quadro: nada de travar o início.
    kiteTools: (id): string | null => {
      try {
        return canvasBridge.configFile(`agent:${id}`)
      } catch (err) {
        log.warn('não foi possível preparar as ferramentas do quadro', {
          error: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
  })
  const agentService = agents
  // Hooks do Claude Code (Fase 6). KITE_CLAUDE_SETTINGS isola o settings.json nos testes.
  const spoolDir = join(app.getPath('userData'), 'agent-events')
  // Um serviço por CLI (Claude Code, Codex, Gemini), todos com o mesmo kite-hook.sh.
  // KITE_CLAUDE_SETTINGS / KITE_CODEX_HOOKS / KITE_GEMINI_SETTINGS isolam os arquivos nos testes.
  const wrapperPath = join(app.getPath('userData'), 'kite-hook.sh')
  const wrapperContent = wrapperScript(hook.exec, hook.script, spoolDir)
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
    emit: (session) => window.emit('agentSession:changed', session),
    onWaiting: (session) => notifier.session(session),
    isLiveAgent: (id) => agentService.isLive(id),
    onAgentStatus: (id, status) => agentService.applyHookStatus(id, status),
    log: log.child('agent-events'),
  })
  const sessionReview = new SessionReviewService({
    session: (id) => agentEvents.get(id),
    review: gitReview,
    store: new JsonStore<ReviewState>(
      join(app.getPath('userData'), 'review.json'),
      reviewStateSchema,
      { dismissed: {} },
    ),
  })
  const reviewService = new TaskReviewService({
    tasks: taskService,
    git: gitService,
    review: gitReview,
    github: githubService,
    log: log.child('review'),
  })
  return {
    canvasService,
    canvasBridge,
    reviewService,
    sessionReview,
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

export type Services = ReturnType<typeof createServices>
