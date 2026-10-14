import { describe, expect, it } from 'vitest'
import { unseenPart } from './pty-router'

describe('unseenPart', () => {
  const ev = (data: string, end: number) => ({ id: 'x', data, end })
  it('descarta o que já foi mostrado e corta trechos parcialmente vistos', () => {
    expect(unseenPart(ev('abc', 3), 5)).toBe('')
    expect(unseenPart(ev('defgh', 8), 5)).toBe('fgh') // offsets 3..7; 0..4 já mostrados
    expect(unseenPart(ev('ij', 10), 8)).toBe('ij')
  })
})
