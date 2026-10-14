import { join } from 'node:path'
import { subscribe } from '@parcel/watcher'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { z } from 'zod'
import type { EventChannel, EventChannels } from '@shared/ipc-contract'
import { registerAppIpc } from './ipc/app.ipc'
import { registerDialogIpc } from './ipc/dialog.ipc'
import { registerFsIpc } from './ipc/fs.ipc'
import { registerWorkspaceIpc } from './ipc/workspace.ipc'
import { JsonStore } from './lib/json-store'
import { logger } from './lib/logger'
import { WorkspaceGuard } from './lib/workspace-guard'
import { installMenu } from './menu'
import { AppService } from './services/app.service'
import { FsService } from './services/fs.service'
import { WatchService } from './services/watch.service'
import { WorkspaceService, type WorkspaceState } from './services/workspace.service'

const log = logger
let mainWindow: BrowserWindow | null = null

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
    if (url.startsWith('https://')) void shell.openExternal(url)
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
    onRootClosed: (root) => watchService.unwatch(root),
  })
  return { appService, fsService, watchService, workspaceService }
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

  const open = (): void => {
    mainWindow = createWindow()
    mainWindow.on('closed', () => {
      mainWindow = null
      void services.watchService.unwatchAll()
    })
  }
  open()
  log.info('janela criada')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) open()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
