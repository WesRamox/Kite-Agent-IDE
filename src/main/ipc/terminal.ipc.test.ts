import { describe, expect, it } from 'vitest'
import { ptyCreateSchema } from './terminal.ipc'

describe('ptyCreateSchema', () => {
  it('descarta env vindo do renderer', () => {
    const parsed = ptyCreateSchema.parse({
      cwd: '/home/u/ws',
      cols: 80,
      rows: 24,
      env: { LD_PRELOAD: '/tmp/x.so', NODE_OPTIONS: '--require /tmp/x.js' },
    })
    expect(parsed).toEqual({ cwd: '/home/u/ws', cols: 80, rows: 24 })
  })

  it('recusa dimensões fora do limite', () => {
    expect(ptyCreateSchema.safeParse({ cwd: '/ws', cols: 0, rows: 24 }).success).toBe(false)
    expect(ptyCreateSchema.safeParse({ cwd: '/ws', cols: 80, rows: 99_999 }).success).toBe(false)
  })
})
