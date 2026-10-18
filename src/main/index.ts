import { app, BrowserWindow } from 'electron'
import { createServices } from './app/container'
import { disposeServices, startBackground } from './app/lifecycle'
import { createMainWindow, MainWindowRef } from './app/main-window'
import { NativeTheme } from './app/native-theme'
import { prepareProfile } from './app/profile'
import { registerAllIpc } from './app/register-ipc'
import { logger as log } from './lib/logger'
import { installMenu } from './menu'

const window = new MainWindowRef()
const theme = new NativeTheme()
// O renderer já salvou terminais e arquivos: o próximo `close` da janela segue direto.
let closeConfirmed = false
let quitting = false

prepareProfile(log)

void app.whenReady().then(async () => {
  installMenu()
  const services = createServices({ window, theme })
  await services.settingsService.init()
  registerAllIpc({
    services,
    window,
    log: log.child('ipc'),
    confirmClose: async () => {
      // Salva o estado dos agentes antes que o processo termine.
      await services.agentService.shutdown()
      closeConfirmed = true
      if (quitting) app.quit()
      else window.current?.close()
    },
  })
  const stopBackground = startBackground(services, log)

  const open = (): void => {
    closeConfirmed = false
    const win = createMainWindow(theme.background, log)
    window.current = win
    // Antes de fechar, o renderer salva os terminais e pergunta sobre arquivos não salvos.
    // Ele responde com `app:confirmClose`; se não puder (travado), fecha direto.
    win.on('close', (event) => {
      if (closeConfirmed || win.webContents.isCrashed() || win.webContents.isLoading()) return
      event.preventDefault()
      win.webContents.send('app:closeRequested', {})
    })
    win.on('closed', () => {
      window.current = null
      stopBackground()
      disposeServices(services)
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
