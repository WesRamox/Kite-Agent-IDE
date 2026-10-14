import { describe, expect, it } from 'vitest'
import { decodeText, encodeText, looksBinary } from './file-content'

describe('file-content', () => {
  it('detecta binário por byte nulo', () => {
    expect(looksBinary(Buffer.from([0x50, 0x4e, 0x47, 0x00, 0x01]))).toBe(true)
    expect(looksBinary(Buffer.from('texto normal\n', 'utf8'))).toBe(false)
  })

  it('preserva o BOM do UTF-8 na ida e na volta', () => {
    const withBom = Buffer.from([0xef, 0xbb, 0xbf, 0x6f, 0x69])
    const decoded = decodeText(withBom)
    expect(decoded).toEqual({ content: 'oi', encoding: 'utf8bom' })
    expect(encodeText(decoded.content, decoded.encoding).equals(withBom)).toBe(true)
  })

  it('decodifica UTF-8 sem BOM', () => {
    expect(decodeText(Buffer.from('ação', 'utf8'))).toEqual({ content: 'ação', encoding: 'utf8' })
  })
})
