import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { t } from './lib/i18n'

// Sem barra de menu: o Kite é um app, não um site. No Windows/Linux o menu some por completo
// (e com ele os atalhos de recarregar, zoom e DevTools). Ctrl/Cmd+W fecha a aba ativa,
// tratado no renderer.
// O macOS sempre mostra uma barra de menu do sistema e só repassa Cmd+C/V/X/A/Z aos campos de
// texto pelos papéis do menu Edit, então lá fica um menu mínimo, sem View/DevTools.
export function installMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: t('menu.mac.edit'),
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
