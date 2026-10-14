import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { registerAppIpc } from './ipc/app.ipc'
import { logger } from './lib/logger'
import { AppService } from './services/app.service'

const log = logger

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
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

function registerIpc(): void {
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
  registerAppIpc(appService, log.child('ipc'))
}

void app.whenReady().then(() => {
  registerIpc()
  createWindow()
  log.info('janela criada')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
