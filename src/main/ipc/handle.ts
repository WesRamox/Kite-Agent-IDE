import type { z } from 'zod'
import type { InvokeArgs, InvokeChannel, InvokeData, InvokeResult } from '@shared/ipc-contract'
import { AppException } from '../lib/errors'
import type { Logger } from '../lib/logger'

export type ArgsSchema<C extends InvokeChannel> = z.ZodType<InvokeArgs<C>>
export type HandlerFn<C extends InvokeChannel> = (
  ...args: InvokeArgs<C>
) => InvokeData<C> | Promise<InvokeData<C>>

// Cria um handler independente do Electron: valida os argumentos com zod,
// executa a função e converte qualquer erro em { ok: false, error }.
export function createHandler<C extends InvokeChannel>(
  channel: C,
  schema: ArgsSchema<C>,
  fn: HandlerFn<C>,
  log: Logger,
): (rawArgs: unknown[]) => Promise<InvokeResult<C>> {
  return async (rawArgs) => {
    const parsed = schema.safeParse(rawArgs)
    if (!parsed.success) {
      log.warn('argumentos inválidos', { channel, issues: parsed.error.issues.length })
      return { ok: false, error: { code: 'INVALID_ARGS', message: 'Argumentos inválidos' } }
    }
    try {
      return { ok: true, data: await fn(...parsed.data) }
    } catch (err) {
      if (err instanceof AppException) return { ok: false, error: err.toAppError() }
      log.error('erro inesperado no handler', {
        channel,
        error: err instanceof Error ? err.message : String(err),
      })
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro interno' } }
    }
  }
}
