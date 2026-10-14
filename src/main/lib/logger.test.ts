import { describe, expect, it } from 'vitest'
import { createLogger, type LogLevel } from './logger'

function capture(min: LogLevel) {
  const lines: [LogLevel, string][] = []
  const log = createLogger('svc', min, (level, line) => lines.push([level, line]))
  return { log, lines }
}

describe('createLogger', () => {
  it('filtra mensagens abaixo do nível mínimo', () => {
    const { log, lines } = capture('warn')
    log.debug('a')
    log.info('b')
    log.warn('c')
    log.error('d')
    expect(lines.map(([level]) => level)).toEqual(['warn', 'error'])
  })

  it('inclui escopo e metadados na linha', () => {
    const { log, lines } = capture('debug')
    log.child('fs').info('lido', { bytes: 3 })
    expect(lines[0]?.[1]).toMatch(/INFO \[svc:fs\] lido \{"bytes":3\}$/)
  })
})
