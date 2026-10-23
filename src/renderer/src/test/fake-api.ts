import type { Api } from '@shared/ipc-contract'
import type { ErrorCode, Result } from '@shared/types'
import { vi } from 'vitest'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })
export const fail = (message: string, code: ErrorCode = 'INTERNAL'): Result<never> => ({
  ok: false,
  error: { code, message },
})

// Chamar algo que não foi definido falha com o nome do canal, em vez de um "undefined is not a
// function" sem pista.
function strict(obj: object, path: string): unknown {
  return new Proxy(obj, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key)
      if (value === undefined && typeof key === 'string')
        throw new Error(`window.api.${path}${String(key)} não foi definido no teste`)
      return typeof value === 'object' && value !== null
        ? strict(value, `${path}${String(key)}.`)
        : value
    },
  })
}

// Instala um window.api falso com só o que o teste usa (troca o window inteiro).
export function installApi(api: DeepPartial<Api>): void {
  vi.stubGlobal('window', {
    api: strict(api, ''),
    open: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

// Para testes de componente: põe o window.api falso no window do happy-dom, que o render usa.
// Devolve a função que o tira.
export function installApiInDom(api: DeepPartial<Api>): () => void {
  Object.defineProperty(window, 'api', { value: strict(api, ''), configurable: true })
  return () => Reflect.deleteProperty(window, 'api')
}

// Promessa resolvida de fora, para controlar a ordem das respostas.
export function deferred<T>() {
  let resolve: (v: T) => void = () => {}
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
