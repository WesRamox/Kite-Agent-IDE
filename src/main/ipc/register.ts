import { ipcMain } from 'electron'
import type { InvokeChannel } from '@shared/ipc-contract'
import type { Logger } from '../lib/logger'
import { createHandler, type ArgsSchema, type HandlerFn } from './handle'

export function registerHandler<C extends InvokeChannel>(
  channel: C,
  schema: ArgsSchema<C>,
  fn: HandlerFn<C>,
  log: Logger,
): void {
  const handler = createHandler(channel, schema, fn, log)
  ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(args))
}
