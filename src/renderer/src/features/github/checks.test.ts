import { describe, expect, it } from 'vitest'
import { runState } from './checks'

describe('runState', () => {
  it('mapeia conclusões e status', () => {
    expect(runState({ status: 'completed', conclusion: 'success' })).toBe('success')
    expect(runState({ status: 'completed', conclusion: 'skipped' })).toBe('success')
    expect(runState({ status: 'in_progress', conclusion: null })).toBe('pending')
    expect(runState({ status: 'pending', conclusion: null })).toBe('pending')
    expect(runState({ status: 'completed', conclusion: 'failure' })).toBe('failure')
    expect(runState({ status: 'error', conclusion: 'error' })).toBe('failure')
  })
})
