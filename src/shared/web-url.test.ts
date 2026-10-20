import { describe, expect, it } from 'vitest'
import { isWebUrl, toBrowserUrl } from './web-url'

describe('web-url', () => {
  it('aceita só http e https', () => {
    expect(isWebUrl('https://exemplo.com/a')).toBe(true)
    expect(isWebUrl('http://localhost:3001')).toBe(true)
    expect(isWebUrl('file:///etc/passwd')).toBe(false)
    expect(isWebUrl('javascript:alert(1)')).toBe(false)
    expect(isWebUrl('não é endereço')).toBe(false)
  })

  it('entende o que a pessoa digitou na barra', () => {
    expect(toBrowserUrl('https://exemplo.com/a?b=1')).toBe('https://exemplo.com/a?b=1')
    expect(toBrowserUrl('exemplo.com.br/voos')).toBe('https://exemplo.com.br/voos')
    expect(toBrowserUrl('3001')).toBe('http://localhost:3001/')
    expect(toBrowserUrl('3001/busca')).toBe('http://localhost:3001/busca')
    expect(toBrowserUrl('localhost:8080/admin')).toBe('http://localhost:8080/admin')
    expect(toBrowserUrl('passagem barata rio')).toBe(
      'https://www.google.com/search?q=passagem%20barata%20rio',
    )
    expect(toBrowserUrl('  ')).toBeNull()
  })

  it('o que não é web vira pesquisa, nunca abre direto', () => {
    expect(toBrowserUrl('javascript:alert(1)')).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
    expect(toBrowserUrl('file:///etc/passwd')).toMatch(/^https:\/\/www\.google\.com\/search\?q=/)
  })
})
