import { describe, expect, it } from 'vitest'
import { fitMenu } from './menu-position'

const viewport = { width: 1000, height: 700 }

describe('fitMenu', () => {
  it('abre no ponto do clique quando cabe', () => {
    expect(fitMenu({ x: 100, y: 200 }, { width: 200, height: 300 }, viewport)).toEqual({
      left: 100,
      top: 200,
    })
  })

  it('sobe o menu alto aberto perto da borda de baixo, com a altura real dele', () => {
    expect(fitMenu({ x: 100, y: 450 }, { width: 200, height: 374 }, viewport)).toEqual({
      left: 100,
      top: 318,
    })
  })

  it('puxa para a esquerda o menu aberto perto da borda direita', () => {
    expect(fitMenu({ x: 950, y: 10 }, { width: 200, height: 100 }, viewport).left).toBe(792)
  })

  it('menu maior que a janela fica na margem de cima', () => {
    expect(fitMenu({ x: 0, y: 300 }, { width: 200, height: 900 }, viewport)).toEqual({
      left: 8,
      top: 8,
    })
  })
})
