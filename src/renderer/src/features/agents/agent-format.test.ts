import { describe, expect, it } from 'vitest'
import { formatDuration } from './agent-format'

describe('formatDuration', () => {
  it('formata segundos, minutos e horas', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(192_000)).toBe('3m 12s')
    expect(formatDuration(3_900_000)).toBe('1h 05m')
    expect(formatDuration(-5)).toBe('0s')
  })
})
