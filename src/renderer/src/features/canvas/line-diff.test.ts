import { describe, expect, it } from 'vitest'
import { changedLines } from './line-diff'

describe('changedLines', () => {
  it('texto igual não tem trecho alterado', () => {
    expect(changedLines('a\nb', 'a\nb')).toBeNull()
  })

  it('uma linha trocada no meio', () => {
    expect(changedLines('a\nb\nc', 'a\nX\nc')).toEqual({ start: 2, end: 2 })
  })

  it('várias linhas trocadas de uma vez', () => {
    expect(changedLines('a\nb\nc\nd', 'a\nX\nY\nd')).toEqual({ start: 2, end: 3 })
  })

  it('linhas acrescentadas no fim', () => {
    expect(changedLines('a\nb', 'a\nb\nc\nd')).toEqual({ start: 3, end: 4 })
  })

  it('linha inserida no meio aponta para a linha nova', () => {
    expect(changedLines('a\nc', 'a\nb\nc')).toEqual({ start: 2, end: 2 })
  })

  it('linha apagada aponta para onde ela estava, sem passar do fim', () => {
    expect(changedLines('a\nb\nc', 'a\nc')).toEqual({ start: 2, end: 2 })
    expect(changedLines('a\nb', 'a')).toEqual({ start: 1, end: 1 })
  })

  it('arquivo esvaziado e arquivo que ganhou conteúdo', () => {
    expect(changedLines('a\nb', '')).toEqual({ start: 1, end: 1 })
    expect(changedLines('', 'a\nb')).toEqual({ start: 1, end: 2 })
  })
})
