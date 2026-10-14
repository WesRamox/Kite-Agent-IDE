import type { AppError, Result } from '@shared/types'
import { toast } from '../stores/toast.store'

export class IpcError extends Error {
  constructor(readonly error: AppError) {
    super(error.message)
    this.name = 'IpcError'
  }
}

// Converte o Result do main em valor ou exceção.
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const res = await promise
  if (!res.ok) throw new IpcError(res.error)
  return res.data
}

// Executa uma chamada e mostra um toast de erro amigável em caso de falha.
export async function attempt<T>(promise: Promise<Result<T>>, context: string): Promise<T | null> {
  const res = await promise
  if (res.ok) return res.data
  toast.error(`${context}: ${res.error.message}`)
  return null
}
