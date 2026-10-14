import { describe, expect, it } from 'vitest'
import { detectLanguage, type LanguageInfo } from './language'

const langs: LanguageInfo[] = [
  { id: 'typescript', extensions: ['.ts', '.tsx'] },
  { id: 'json', extensions: ['.json'], filenames: ['.babelrc'] },
  { id: 'dockerfile', extensions: ['.dockerfile'], filenames: ['Dockerfile'] },
  { id: 'markdown', extensions: ['.md'] },
]

describe('detectLanguage', () => {
  it('usa a extensão, sem diferenciar maiúsculas', () => {
    expect(detectLanguage('App.TSX', langs)).toBe('typescript')
    expect(detectLanguage('README.md', langs)).toBe('markdown')
  })
  it('usa nomes de arquivo conhecidos', () => {
    expect(detectLanguage('Dockerfile', langs)).toBe('dockerfile')
    expect(detectLanguage('.babelrc', langs)).toBe('json')
  })
  it('cai em plaintext', () => {
    expect(detectLanguage('LICENSE', langs)).toBe('plaintext')
  })
})
