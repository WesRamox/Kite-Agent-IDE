import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, ipcMain } from 'electron'
import type { InvokeChannel } from '@shared/ipc-contract'
import type { Logger } from '../lib/logger'
import { t } from '../lib/i18n'
import { createHandler, type ArgsSchema, type HandlerFn } from './handle'
import { isTrustedSender, type TrustedRenderer } from './sender'

// Mesmo caminho que a janela carrega (main/index.ts): o bundle do main fica em out/main.
function trustedRenderer(): TrustedRenderer {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return {
    file: pathToFileURL(join(__dirname, '../renderer/index.html')).href,
    ...(!app.isPackaged && devUrl ? { devUrl } : {}),
  }
}

export function registerHandler<C extends InvokeChannel>(
  channel: C,
  schema: ArgsSchema<C>,
  fn: HandlerFn<C>,
  log: Logger,
): void {
  const handler = createHandler(channel, schema, fn, log)
  const trusted = trustedRenderer()
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    if (!isTrustedSender(event.senderFrame?.url, trusted)) {
      log.warn('chamada IPC de origem não confiável', { channel })
      return { ok: false, error: { code: 'PERMISSION_DENIED', message: t('error.notPermitted') } }
    }
    return handler(args)
  })
}
