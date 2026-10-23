// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useLayoutStore } from '../../stores/layout.store'
import { useEditorStore } from '../editor/editor.store'
import { segments, splitRel } from './search'
import { openSearch } from './search.actions'
import { useSearchStore } from './search.store'

describe('segments', () => {
  it('separa as ocorrências do resto da linha', () => {
    expect(
      segments('a foo b foo', [
        [2, 5],
        [8, 11],
      ]),
    ).toEqual([
      { text: 'a ', hit: false },
      { text: 'foo', hit: true },
      { text: ' b ', hit: false },
      { text: 'foo', hit: true },
    ])
  })

  it('ignora faixas fora do trecho, sobrepostas ou fora de ordem', () => {
    expect(
      segments('abcdef', [
        [4, 99],
        [0, 2],
        [1, 3],
      ]),
    ).toEqual([
      { text: 'ab', hit: true },
      { text: 'c', hit: true },
      { text: 'd', hit: false },
      { text: 'ef', hit: true },
    ])
    expect(segments('abc', [])).toEqual([{ text: 'abc', hit: false }])
  })
})

describe('splitRel', () => {
  it('separa o nome da pasta', () => {
    expect(splitRel('src/features/x.ts')).toEqual({ name: 'x.ts', dir: 'src/features' })
    expect(splitRel('x.ts')).toEqual({ name: 'x.ts', dir: '' })
  })
})

describe('openSearch', () => {
  beforeEach(() => useLayoutStore.setState({ activeView: 'explorer', sidebarVisible: true }))

  it('mostra a view e pede foco no campo', () => {
    const before = useSearchStore.getState().focusSeq
    openSearch()
    expect(useLayoutStore.getState()).toMatchObject({ activeView: 'search', sidebarVisible: true })
    expect(useSearchStore.getState().focusSeq).toBe(before + 1)
  })

  it('com a view já aberta, não recolhe a barra lateral', () => {
    useLayoutStore.setState({ activeView: 'search', sidebarVisible: true })
    openSearch()
    expect(useLayoutStore.getState().sidebarVisible).toBe(true)
  })
})

describe('revelar no editor', () => {
  it('cada pedido ganha um número; limpar um pedido antigo não apaga o novo', () => {
    const editor = useEditorStore.getState()
    editor.requestReveal({ path: '/a.ts', line: 3, column: 2, length: 3 })
    const first = useEditorStore.getState().reveal?.seq ?? 0
    editor.requestReveal({ path: '/a.ts', line: 9, column: 1, length: 3 })
    editor.clearReveal(first)
    expect(useEditorStore.getState().reveal).toMatchObject({ line: 9, seq: first + 1 })
    editor.clearReveal(first + 1)
    expect(useEditorStore.getState().reveal).toBeNull()
  })
})
