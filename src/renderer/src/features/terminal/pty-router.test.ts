import type { PtyDataEvent } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { installApi } from '../../test/fake-api'
import { routePty, unseenPart } from './pty-router'

describe('unseenPart', () => {
  const ev = (data: string, end: number) => ({ id: 'x', data, end })
  it('descarta o que já foi mostrado e corta trechos parcialmente vistos', () => {
    expect(unseenPart(ev('abc', 3), 5)).toBe('')
    expect(unseenPart(ev('defgh', 8), 5)).toBe('fgh') // offsets 3..7; 0..4 já mostrados
    expect(unseenPart(ev('ij', 10), 8)).toBe('ij')
  })
})

describe('routePty', () => {
  it('entrega a saída a todas as sessões do mesmo PTY e solta cada uma sozinha', () => {
    let emit: (e: PtyDataEvent) => void = () => {}
    installApi({
      pty: {
        onData: (fn: (e: PtyDataEvent) => void) => {
          emit = fn
          return () => {}
        },
        onExit: () => () => {},
      },
    })
    const a: string[] = []
    const b: string[] = []
    const offA = routePty('p1', { data: (e) => a.push(e.data), exit: () => {} })
    routePty('p1', { data: (e) => b.push(e.data), exit: () => {} })
    emit({ id: 'p1', data: 'oi', end: 2 })
    offA()
    emit({ id: 'p1', data: '!', end: 3 })
    expect(a).toEqual(['oi'])
    expect(b).toEqual(['oi', '!'])
  })
})
