import { join } from 'node:path'
import { app, BrowserWindow, session, shell } from 'electron'
import type { EventChannel, EventChannels } from '@shared/ipc-contract'
import { BROWSER_PARTITION } from '@shared/browser'
import { isWebUrl } from '@shared/web-url'
import type { Logger } from '../lib/logger'

// A janela principal do momento (fecha e reabre no macOS) e o envio de eventos para ela.
export class MainWindowRef {
  current: BrowserWindow | null = null

  emit<E extends EventChannel>(channel: E, payload: EventChannels[E]): void {
    const win = this.current
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  // Traz a janela para a frente (clique numa notificação).
  reveal(): boolean {
    const win = this.current
    if (!win) return false
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return true
  }
}

export function createMainWindow(background: string, log: Logger): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    show: false,
    backgroundColor: background,
    title: 'Kite',
    // Sem a barra de título do sistema: a barra de menus do Kite faz o papel dela (arrastar e
    // botões da janela). No macOS ficam os botões nativos, embutidos no canto.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : { frame: false }),
    // Em dev/build local; no pacote final o ícone vem do instalador.
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Navegador do quadro. Travado abaixo: só http(s), sem preload e sem Node.
      webviewTag: true,
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

  lockBrowserNodes(win)

  // Erros da interface vão para o log (e o arquivo de log) também no app instalado; o resto do
  // console só em desenvolvimento.
  win.webContents.on('console-message', (details) => {
    if (details.level === 'error') log.child('renderer').error(details.message)
    else if (!app.isPackaged) log.child('renderer').debug(details.message, { level: details.level })
  })
  // A interface caiu ou travou: registra e recarrega, em vez de deixar a janela preta.
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('a interface caiu', { reason: details.reason, exitCode: details.exitCode })
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) win.webContents.reload()
  })
  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))
  win.on('unresponsive', () => log.warn('a janela parou de responder'))
  win.on('responsive', () => log.info('a janela voltou a responder'))

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// O navegador do quadro (<webview>) roda numa sessão própria, sem preload e sem Node, e só abre
// http e https. Janela nova vira navegação no próprio bloco. Câmera, microfone, localização e
// afins ficam negados: são sites de fora, dentro do Kite.
function lockBrowserNodes(win: BrowserWindow): void {
  const browser = session.fromPartition(BROWSER_PARTITION)
  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write'])
  browser.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(allowed.has(permission)),
  )
  browser.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))

  win.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload
    prefs.nodeIntegration = false
    prefs.nodeIntegrationInSubFrames = false
    prefs.contextIsolation = true
    prefs.sandbox = true
    prefs.webSecurity = true
    if (!isWebUrl(params.src ?? '') || params.partition !== BROWSER_PARTITION) {
      event.preventDefault()
    }
  })
  win.webContents.on('did-attach-webview', (_event, guest) => {
    guest.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url)) void guest.loadURL(url)
      return { action: 'deny' }
    })
    guest.on('will-navigate', (event, url) => {
      if (!isWebUrl(url)) event.preventDefault()
    })
    guest.on('will-redirect', (event, url) => {
      if (!isWebUrl(url)) event.preventDefault()
    })
  })
}
