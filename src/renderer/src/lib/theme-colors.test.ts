import { describe, expect, it, vi } from 'vitest'
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

describe('paletteOf', () => {
  it('não guarda em cache a paleta lida antes do CSS carregar', async () => {
    let vars: Record<string, string> = {}
    vi.stubGlobal('document', {
      createElement: () => ({ dataset: {}, style: {}, remove() {}, getContext: () => null }),
      body: { appendChild() {} },
    })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => vars[name] ?? '',
    }))
    try {
      const { paletteOf } = await import('./theme-colors')
      expect(paletteOf('kite').fg).toBe('')
      vars = { '--color-fg': '#EDEDEC' }
      for (const t of ['surface-0', 'surface-1', 'surface-2', 'surface-3', 'border', 'fg-muted'])
        vars[`--color-${t}`] = '#000000'
      for (const t of ['accent', 'success', 'warning', 'danger', 'info', 'merged'])
        vars[`--color-${t}`] = '#111111'
      expect(paletteOf('kite').fg).toBe('#ededec')
      vars = {}
      expect(paletteOf('kite').fg).toBe('#ededec') // agora vem do cache
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
