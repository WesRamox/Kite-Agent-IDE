import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyMatch } from './fuzzy'

describe('fuzzyMatch', () => {
  it('exige os caracteres em ordem', () => {
    expect(fuzzyMatch('abc', 'a_b_c')).not.toBeNull()
    expect(fuzzyMatch('cba', 'abc')).toBeNull()
  })

  it('ignora maiúsculas e espaços na consulta', () => {
    expect(fuzzyMatch('Fs Serv', 'src/main/fs.service.ts')).not.toBeNull()
  })

  it('retorna as posições casadas', () => {
    expect(fuzzyMatch('ab', 'xaxb')?.positions).toEqual([1, 3])
  })
})

describe('fuzzyFilter', () => {
  const files = [
    'src/renderer/src/app/App.tsx',
    'src/main/services/fs.service.ts',
    'docs/fs-notes.md',
    'src/main/services/fs.service.test.ts',
  ]

  it('prioriza casamento contíguo no nome do arquivo', () => {
    const ranked = fuzzyFilter('fsserv', files, (f) => f).map((r) => r.item)
    expect(ranked[0]).toBe('src/main/services/fs.service.ts')
    expect(ranked).not.toContain('src/renderer/src/app/App.tsx')
  })

  it('consulta vazia mantém todos', () => {
    expect(fuzzyFilter('', files, (f) => f)).toHaveLength(files.length)
  })
})
