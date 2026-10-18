// Erros e resultado de todo canal IPC.

export type ErrorCode =
  | 'INVALID_ARGS'
  | 'NOT_FOUND'
  | 'FORBIDDEN_PATH'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'FILE_TOO_LARGE'
  | 'BINARY_FILE'
  | 'NOT_A_REPO'
  | 'GIT_ERROR'
  | 'NOT_CONFIGURED'
  | 'NOT_AUTHENTICATED'
  | 'NOT_GITHUB_REPO'
  | 'GITHUB_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'INVALID_SETTINGS'
  | 'INTERNAL'

export interface AppError {
  code: ErrorCode
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
