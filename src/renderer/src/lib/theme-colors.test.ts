import { describe, expect, it } from 'vitest'
import { withAlpha } from './theme-colors'

describe('withAlpha', () => {
  it('acrescenta ou troca o canal alfa', () => {
    expect(withAlpha('#3b82f6', 0.5)).toBe('#3b82f680')
    expect(withAlpha('#ffffff17', 1)).toBe('#ffffffff')
    expect(withAlpha('#000000', 0)).toBe('#00000000')
  })
})

describe('toHex (formatos hex)', () => {
  it('expande hex curto e mantém hex longo', async () => {
    const { toHex } = await import('./theme-colors')
    expect(toHex('#fff')).toBe('#ffffff')
    expect(toHex('#fff3')).toBe('#ffffff33')
    expect(toHex('#3B82F6')).toBe('#3b82f6')
    expect(toHex('#ffffff17')).toBe('#ffffff17')
  })
})
