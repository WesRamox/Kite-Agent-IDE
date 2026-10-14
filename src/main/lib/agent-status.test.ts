import { describe, expect, it } from 'vitest'
import { hasMeaningfulOutput, StatusDetector } from './agent-status'

describe('hasMeaningfulOutput', () => {
  it('ignora sequências de controle', () => {
    expect(hasMeaningfulOutput('\x1b[?25l\x1b[2K\x1b[1G\x1b[?25h')).toBe(false)
    expect(hasMeaningfulOutput('\x1b]0;título\x07')).toBe(false)
    expect(hasMeaningfulOutput('\x1b[32m\x1b[0m\r\n')).toBe(false)
  })
  it('reconhece texto, mesmo colorido', () => {
    expect(hasMeaningfulOutput('\x1b[32mEditando arquivo\x1b[0m')).toBe(true)
    expect(hasMeaningfulOutput('⠋')).toBe(true)
  })
})

describe('StatusDetector', () => {
  it('running → waiting após ficar ocioso → running com nova saída', () => {
    const d = new StatusDetector({ idleMs: 1000 }, 0)
    expect(d.current).toBe('running')
    expect(d.tick(500)).toBeNull()
    expect(d.tick(1000)).toBe('waiting')
    expect(d.tick(5000)).toBeNull()
    expect(d.output('trabalhando', 6000)).toBe('running')
    expect(d.tick(6500)).toBeNull()
  })

  it('redesenhos sem texto não mantêm o agente como running', () => {
    const d = new StatusDetector({ idleMs: 1000 }, 0)
    expect(d.output('\x1b[?25l\x1b[?25h', 900)).toBeNull()
    expect(d.tick(1000)).toBe('waiting')
  })

  it('saída conta a partir do último texto', () => {
    const d = new StatusDetector({ idleMs: 1000 }, 0)
    d.output('a', 800)
    expect(d.tick(1500)).toBeNull()
    expect(d.tick(1800)).toBe('waiting')
  })

  it('exit define done/error e congela o status', () => {
    const ok = new StatusDetector({ idleMs: 1000 }, 0)
    expect(ok.exit(0)).toBe('done')
    expect(ok.output('x', 10)).toBeNull()
    expect(ok.tick(99999)).toBeNull()
    expect(ok.exit(1)).toBeNull()

    const bad = new StatusDetector({ idleMs: 1000 }, 0)
    expect(bad.exit(2)).toBe('error')
  })
})
