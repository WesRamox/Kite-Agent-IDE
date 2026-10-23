import { clipboard, dialog, webContents } from 'electron'
import { registerAgentIpc } from '../ipc/agent.ipc'
import { registerAgentSessionIpc } from '../ipc/agent-session.ipc'
import { registerAppIpc } from '../ipc/app.ipc'
import { registerCanvasIpc } from '../ipc/canvas.ipc'
import { registerDialogIpc } from '../ipc/dialog.ipc'
import { registerFsIpc } from '../ipc/fs.ipc'
import { registerGitIpc } from '../ipc/git.ipc'
import { registerGitHubIpc } from '../ipc/github.ipc'
import { registerReviewIpc } from '../ipc/review.ipc'
import { registerSearchIpc } from '../ipc/search.ipc'
import { registerSettingsIpc } from '../ipc/settings.ipc'
import { registerSystemIpc } from '../ipc/system.ipc'
import { registerTaskIpc } from '../ipc/task.ipc'
import { registerTerminalIpc } from '../ipc/terminal.ipc'
import { registerWorkspaceIpc } from '../ipc/workspace.ipc'
import { AppException } from '../lib/errors'
import { t } from '../lib/i18n'
import type { Logger } from '../lib/logger'
import type { Services } from './container'
import type { MainWindowRef } from './main-window'

export interface IpcDeps {
  services: Services
  window: MainWindowRef
  // O renderer terminou de salvar tudo e o fechamento pode seguir.
  confirmClose: () => Promise<void>
  log: Logger
}

export function registerAllIpc({ services, window, confirmClose, log }: IpcDeps): void {
  registerAppIpc(services.appService, log)
  registerWorkspaceIpc(services.workspaceService, log)
  registerFsIpc(services.fsService, services.watchService, log)
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
    const res = window.current
      ? await dialog.showMessageBox(window.current, box)
      : await dialog.showMessageBox(box)
    return res.response
  }, log)
  registerTerminalIpc(services.ptyService, services.sessionService, log)
  registerGitIpc(services.gitService, services.gitWatchService, log)
  registerGitHubIpc(services.githubAuth, services.githubService, log)
  registerAgentIpc(services.agentService, services.taskService, log)
  registerAgentSessionIpc(services.agentEvents, services.sessionReview, services.hooksServices, log)
  registerTaskIpc(services.taskService, services.taskCompletion, log)
  registerReviewIpc(services.reviewService, log)
  registerSearchIpc(services.searchService, log)
  registerCanvasIpc(
    services.canvasService,
    services.canvasBridge,
    async (id) => {
      const guest = webContents.fromId(id)
      // Só os navegadores do quadro desta janela; nunca a própria interface do Kite.
      if (
        !guest ||
        guest.getType() !== 'webview' ||
        guest.hostWebContents !== window.current?.webContents
      ) {
        throw new AppException('NOT_FOUND', t('error.notFound'))
      }
      return (await guest.capturePage()).toPNG().toString('base64')
    },
    log,
  )
  registerSettingsIpc(services.settingsService, log)
  registerSystemIpc(
    {
      readClipboard: () => clipboard.readText(),
      writeClipboard: (text) => clipboard.writeText(text),
      confirmClose,
      window: {
        minimize: () => window.current?.minimize(),
        toggleMaximize: () => {
          if (window.current?.isMaximized()) window.current.unmaximize()
          else window.current?.maximize()
        },
        // Passa pelo fluxo normal de fechar (salva terminais, pergunta sobre arquivos).
        close: () => window.current?.close(),
        isMaximized: () => window.current?.isMaximized() ?? false,
      },
    },
    log,
  )
}
