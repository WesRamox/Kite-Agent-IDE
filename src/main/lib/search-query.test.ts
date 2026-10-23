import path from 'node:path'
import type { SearchQuery } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { grepArgs, matcher, matchRanges, parseGrep, pathspecs, preview } from './search-query'

const q = (patch: Partial<SearchQuery> = {}): SearchQuery => ({
  text: 'foo',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  include: '',
  exclude: '',
  ...patch,
})

describe('grepArgs', () => {
  it('texto que parece opção continua sendo o padrão buscado', () => {
    const args = grepArgs(q({ text: '--open-files-in-pager=calc' }))
    const at = args.indexOf('-e')
    expect(args[at + 1]).toBe('--open-files-in-pager=calc')
    expect(args.indexOf('--')).toBeGreaterThan(at + 1)
  })

  it('traduz as opções: literal, maiúsculas, palavra inteira e regex', () => {
    expect(grepArgs(q())).toEqual(expect.arrayContaining(['-F', '-i']))
    const strict = grepArgs(q({ caseSensitive: true, wholeWord: true, regex: true }))
    expect(strict).toEqual(expect.arrayContaining(['-E', '-w']))
    expect(strict).not.toContain('-i')
  })
})

describe('pathspecs', () => {
  it('como no VS Code: sem barra vale em qualquer pasta; pasta inclui o conteúdo', () => {
    expect(pathspecs('*.ts, src/', 'node_modules')).toEqual([
      ':(glob)**/*.ts',
      ':(glob)**/*.ts/**',
      ':(glob)**/src',
      ':(glob)**/src/**',
      ':(exclude,glob)**/node_modules',
      ':(exclude,glob)**/node_modules/**',
    ])
  })

  it('caminho com barra fica relativo à worktree, sem barra inicial nem ./', () => {
    expect(pathspecs('/src/api/**', '')).toEqual([':(glob)src/api/**', ':(glob)src/api/**/**'])
    expect(pathspecs('.\\lib\\x.ts', '')[0]).toBe(':(glob)lib/x.ts')
  })

  it('a mágica do pathspec é sempre a nossa: a do filtro vira texto do padrão', () => {
    expect(pathspecs(':(top)../../etc', '')[0]).toBe(':(glob):(top)../../etc')
  })
})

describe('matcher e matchRanges', () => {
  it('literal escapa os caracteres de regex', () => {
    expect(matchRanges('a.b axb a.b', matcher(q({ text: 'a.b' })))).toEqual([
      [0, 3],
      [8, 11],
    ])
  })

  it('palavra inteira não marca dentro de outra palavra', () => {
    expect(matchRanges('foo food _foo foo', matcher(q({ wholeWord: true })))).toEqual([
      [0, 3],
      [14, 17],
    ])
  })

  it('ocorrência vazia não trava; regex inválida para o JavaScript não marca nada', () => {
    expect(matchRanges('bbb', matcher(q({ text: 'a*', regex: true })))).toEqual([])
    expect(matcher(q({ text: '(', regex: true }))).toBeNull()
  })
})

describe('preview', () => {
  it('tira o recuo e ajusta as posições', () => {
    expect(preview('    return foo', [[11, 14]])).toEqual({
      preview: 'return foo',
      ranges: [[7, 10]],
    })
  })

  it('linha longa começa um pouco antes da ocorrência, com reticências', () => {
    const text = `${'x'.repeat(500)}foo${'y'.repeat(500)}`
    const out = preview(text, [[500, 503]])
    expect(out.preview.startsWith('…')).toBe(true)
    expect(out.preview.endsWith('…')).toBe(true)
    const [range] = out.ranges
    expect(range && out.preview.slice(range[0], range[1])).toBe('foo')
  })
})

describe('parseGrep', () => {
  const out = 'a b.ts\u00001\u00007\u0000const foo = 1\r\nsrc/c.ts\u00002\u00001\u0000FOO e foo\n'

  it('agrupa por arquivo e usa a coluna em caracteres', () => {
    const res = parseGrep(out, '/wt', matcher(q()), 100, path.posix.join)
    expect(res.files.map((f) => [f.rel, f.path])).toEqual([
      ['a b.ts', '/wt/a b.ts'],
      ['src/c.ts', '/wt/src/c.ts'],
    ])
    expect(res.files[0]?.matches[0]).toMatchObject({ line: 1, column: 7, length: 3 })
    expect(res.files[0]?.matches[0]?.preview).toBe('const foo = 1')
    expect(res.files[1]?.matches[0]?.ranges).toEqual([
      [0, 3],
      [6, 9],
    ])
  })

  it('para no limite e avisa que cortou', () => {
    const res = parseGrep(out, '/wt', matcher(q()), 1, path.posix.join)
    expect(res).toMatchObject({ matches: 1, truncated: true })
  })
})
