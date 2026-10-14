import type { AppError, ErrorCode } from '@shared/types'

// Erro de domínio lançado pelos serviços; o wrapper IPC o converte em { ok: false, error }.
export class AppException extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AppException'
  }

  toAppError(): AppError {
    return { code: this.code, message: this.message }
  }
}
