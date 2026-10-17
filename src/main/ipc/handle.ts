import type { z } from 'zod'
import type { AppError, ErrorCode } from '@shared/types'
import type { InvokeArgs, InvokeChannel, InvokeData, InvokeResult } from '@shared/ipc-contract'
import { AppException } from '../lib/errors'
import type { Logger } from '../lib/logger'
import { t } from '../lib/i18n'

const ERRNO_TO_ERROR: Record<string, AppError> = {
  ENOENT: { code: 'NOT_FOUND', message: t('error.notFound') },
  EEXIST: { code: 'ALREADY_EXISTS', message: t('error.alreadyExists') },
  ENOTEMPTY: { code: 'ALREADY_EXISTS', message: t('error.destNotEmpty') },
  EACCES: { code: 'PERMISSION_DENIED', message: 'Sem permissão' },
  EPERM: { code: 'PERMISSION_DENIED', message: t('error.notPermitted') },
}

function errnoError(err: unknown): AppError | undefined {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' ? ERRNO_TO_ERROR[code] : undefined
}

function fail(code: ErrorCode, message: string): { ok: false; error: AppError } {
  return { ok: false, error: { code, message } }
}

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
      return fail('INVALID_ARGS', t('error.invalidArgs'))
    }
    try {
      return { ok: true, data: await fn(...parsed.data) }
    } catch (err) {
      if (err instanceof AppException) return { ok: false, error: err.toAppError() }
      const mapped = errnoError(err)
      if (mapped) return { ok: false, error: mapped }
      log.error('erro inesperado no handler', {
        channel,
        error: err instanceof Error ? err.message : String(err),
      })
      return fail('INTERNAL', t('error.internal'))
    }
  }
}
