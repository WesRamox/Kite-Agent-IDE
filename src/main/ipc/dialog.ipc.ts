import { z } from 'zod'
import type { ConfirmOptions } from '@shared/types'
import type { Logger } from '../lib/logger'
import { registerHandler } from './register'

const confirmSchema = z.object({
  message: z.string().min(1).max(500),
  detail: z.string().max(2000).optional(),
  buttons: z.array(z.string().min(1).max(40)).min(1).max(4),
  kind: z.enum(['info', 'warning', 'question']).optional(),
})

export function registerDialogIpc(
  confirm: (options: ConfirmOptions) => Promise<number>,
  log: Logger,
): void {
  registerHandler('dialog:confirm', z.tuple([confirmSchema]), (o) => confirm(o), log)
}
