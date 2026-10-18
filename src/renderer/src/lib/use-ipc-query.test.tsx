// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Result } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { useIpcQuery } from './use-ipc-query'

const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
const fail = (message: string): Result<never> => ({
  ok: false,
  error: { code: 'INTERNAL', message },
})

function deferred<T>() {
  let resolve: (v: T) => void = () => {}
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('useIpcQuery', () => {
  it('busca ao montar e entrega o dado', async () => {
    const load = vi.fn(() => Promise.resolve(ok(42)))
    const { result } = renderHook(() => useIpcQuery(load, []))
    await waitFor(() => expect(result.current.data).toBe(42))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('não busca quando load devolve null', () => {
    const { result } = renderHook(() => useIpcQuery(() => null, []))
    expect(result.current).toMatchObject({ data: null, error: null })
  })

  it('descarta a resposta de uma busca substituída', async () => {
    const first = deferred<Result<string>>()
    const second = deferred<Result<string>>()
    const { result, rerender } = renderHook(
      ({ n }) => useIpcQuery(() => (n === 1 ? first.promise : second.promise), [n]),
      { initialProps: { n: 1 } },
    )
    rerender({ n: 2 })
    await act(async () => second.resolve(ok('nova')))
    await act(async () => first.resolve(ok('velha')))
    expect(result.current.data).toBe('nova')
  })

  it('mantém o último dado bom quando a nova busca falha', async () => {
    let res: Result<string> = ok('a')
    const { result } = renderHook(() => useIpcQuery(() => Promise.resolve(res), []))
    await waitFor(() => expect(result.current.data).toBe('a'))
    res = fail('caiu')
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.error).toBe('caiu'))
    expect(result.current.data).toBe('a')
  })

  it('identity nova esconde o dado anterior', async () => {
    const { result, rerender } = renderHook(
      ({ id }) =>
        useIpcQuery(() => (id === 'a' ? Promise.resolve(ok(id)) : null), [id], { identity: id }),
      { initialProps: { id: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('a'))
    rerender({ id: 'b' })
    expect(result.current.data).toBeNull()
  })

  it('chama onData com cada sucesso', async () => {
    const onData = vi.fn()
    renderHook(() => useIpcQuery(() => Promise.resolve(ok(1)), [], { onData }))
    await waitFor(() => expect(onData).toHaveBeenCalledWith(1))
  })
})
