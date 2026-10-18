import { describe, expect, it } from 'vitest'
import { isTrustedSender } from './sender'

const file = 'file:///opt/Kite/resources/app.asar/out/renderer/index.html'

describe('isTrustedSender', () => {
  it('aceita o index.html do renderer, com ou sem hash e query', () => {
    expect(isTrustedSender(file, { file })).toBe(true)
    expect(isTrustedSender(`${file}#/tarefa`, { file })).toBe(true)
    expect(isTrustedSender(`${file}?x=1`, { file })).toBe(true)
  })

  it('recusa outro arquivo local', () => {
    expect(isTrustedSender('file:///tmp/evil.html', { file })).toBe(false)
    expect(
      isTrustedSender('file:///opt/Kite/resources/app.asar/out/renderer/x.html', { file }),
    ).toBe(false)
  })

  it('aceita o servidor de dev só quando configurado', () => {
    const devUrl = 'http://localhost:5173/'
    expect(isTrustedSender('http://localhost:5173/src/main.tsx', { file, devUrl })).toBe(true)
    expect(isTrustedSender('http://localhost:5173/', { file })).toBe(false)
    expect(isTrustedSender('http://localhost:5174/', { file, devUrl })).toBe(false)
  })

  it('recusa páginas remotas, about:blank e frame sem URL', () => {
    expect(isTrustedSender('https://evil.example/', { file })).toBe(false)
    expect(isTrustedSender('about:blank', { file })).toBe(false)
    expect(isTrustedSender(undefined, { file })).toBe(false)
    expect(isTrustedSender('não é url', { file })).toBe(false)
  })
})
