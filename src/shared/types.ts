// Tipos de domínio compartilhados entre main, preload e renderer.

export type ErrorCode =
  | 'INVALID_ARGS'
  | 'NOT_FOUND'
  | 'FORBIDDEN_PATH'
  | 'ALREADY_EXISTS'
  | 'PERMISSION_DENIED'
  | 'FILE_TOO_LARGE'
  | 'BINARY_FILE'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL'

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

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
}

export type FileEncoding = 'utf8' | 'utf8bom'

export interface FileContent {
  content: string
  encoding: FileEncoding
}

export type FsChangeType = 'create' | 'update' | 'delete'

export interface FsChangedEvent {
  root: string
  events: { type: FsChangeType; path: string }[]
}

export interface ConfirmOptions {
  message: string
  detail?: string
  // O primeiro botão é a ação principal; o último é o cancelamento.
  buttons: string[]
  kind?: 'info' | 'warning' | 'question'
}
