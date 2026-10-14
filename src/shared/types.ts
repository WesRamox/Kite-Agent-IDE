// Tipos de domínio compartilhados entre main, preload e renderer.

export type ErrorCode =
  'INVALID_ARGS' | 'NOT_FOUND' | 'FORBIDDEN_PATH' | 'NOT_IMPLEMENTED' | 'INTERNAL'

export interface AppError {
  code: ErrorCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export interface AppInfo {
  name: string
  version: string
  platform: string
  versions: { electron: string; chrome: string; node: string }
}
