import type { Result } from '@shared/types'
import { useEffect, useEffectEvent, useState, type DependencyList } from 'react'

export interface IpcQuery<T> {
  data: T | null
  error: string | null
  // Busca de novo com os mesmos argumentos (botão de atualizar, depois de um commit…).
  reload: () => void
}

export interface IpcQueryOptions<T> {
  // Espera antes de buscar; mudanças seguidas nos deps só disparam a última busca.
  delayMs?: number
  // Quando muda (outro arquivo, outra tarefa), o dado anterior some em vez de aparecer até a
  // resposta nova chegar.
  identity?: string
  // Chamado com cada resposta de sucesso (selecionar o primeiro item, abrir um diálogo…).
  onData?: (data: T) => void
  // Busca de novo quando este valor muda, mesmo sem ser usado no `load` (ex.: status do git).
  // Precisa ser estável entre renders: valor do store, string ou número.
  refresh?: unknown
}

// Dados do main enquanto o componente está montado. Refaz a busca quando `deps` muda (como um
// useEffect; o ESLint confere os deps pelo additionalHooks) e descarta respostas de buscas que
// já foram substituídas. `load` devolvendo null não busca (ex.: sem pasta aberta).
export function useIpcQuery<T>(
  load: () => Promise<Result<T>> | null,
  deps: DependencyList,
  options: IpcQueryOptions<T> = {},
): IpcQuery<T> {
  const { delayMs, identity = '', refresh } = options
  const [state, setState] = useState<{ identity: string; data: T | null; error: string | null }>({
    identity,
    data: null,
    error: null,
  })
  const [version, setVersion] = useState(0)
  const run = useEffectEvent(() => load())
  const loaded = useEffectEvent((data: T) => options.onData?.(data))

  useEffect(() => {
    let alive = true
    const fetch = () => {
      const pending = run()
      if (!pending) return
      void pending.then((res) => {
        if (!alive) return
        if (res.ok) {
          setState({ identity, data: res.data, error: null })
          loaded(res.data)
        } else {
          // Mantém o último dado bom: quem mostra decide se o erro vence.
          setState((prev) => ({
            identity,
            data: prev.identity === identity ? prev.data : null,
            error: res.error.message,
          }))
        }
      })
    }
    const timer = delayMs ? setTimeout(fetch, delayMs) : null
    if (!delayMs) fetch()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
    // Os deps são os de quem chama, conferidos pelo ESLint na chamada (additionalHooks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, identity, delayMs, refresh, version])

  const current = state.identity === identity
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    reload: () => setVersion((v) => v + 1),
  }
}
