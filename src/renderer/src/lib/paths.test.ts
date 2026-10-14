import { describe, expect, it } from 'vitest'
import { basename, dirname, isInside, isValidName, join, rebase, relative } from './paths'

describe('paths (posix)', () => {
  it('basename/dirname/join', () => {
    expect(basename('/a/b/c.ts')).toBe('c.ts')
    expect(dirname('/a/b/c.ts')).toBe('/a/b')
    expect(dirname('/a')).toBe('/')
    expect(join('/a/b', 'c')).toBe('/a/b/c')
    expect(join('/', 'c')).toBe('/c')
  })
  it('isInside não confunde prefixos', () => {
    expect(isInside('/a/b', '/a/b/c')).toBe(true)
    expect(isInside('/a/b', '/a/bc')).toBe(false)
  })
  it('relative e rebase', () => {
    expect(relative('/a', '/a/b/c.ts')).toBe('b/c.ts')
    expect(rebase('/a/old/x.ts', '/a/old', '/a/new')).toBe('/a/new/x.ts')
  })
})

describe('paths (windows)', () => {
  it('lida com separador \\ e drive', () => {
    expect(basename('C:\\repo\\src\\a.ts')).toBe('a.ts')
    expect(dirname('C:\\repo\\src\\a.ts')).toBe('C:\\repo\\src')
    expect(dirname('C:\\repo')).toBe('C:\\')
    expect(join('C:\\repo', 'a.ts')).toBe('C:\\repo\\a.ts')
    expect(relative('C:\\repo', 'C:\\repo\\src\\a.ts')).toBe('src/a.ts')
  })
})

describe('isValidName', () => {
  it('recusa separadores e nomes especiais', () => {
    expect(isValidName('ok.ts')).toBe(true)
    for (const bad of ['', '.', '..', 'a/b', 'a\\b']) expect(isValidName(bad)).toBe(false)
  })
})
