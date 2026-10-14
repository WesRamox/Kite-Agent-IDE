import type { AgentStatus } from '@shared/types'

// Detecção de status por heurística, isolada para ser trocada depois por hooks dos CLIs.
//
// - running: houve saída "real" (texto) recentemente.
// - waiting: sem saída real há `idleMs` (o agente provavelmente espera input).
// - done/error: pelo código de saída.
//
// Sequências de controle (cursor, cores, limpeza de tela, título) sozinhas não contam como
// atividade: TUIs redesenham e piscam o cursor mesmo paradas.

export interface StatusDetectorOptions {
  idleMs: number
}

const ANSI = new RegExp(
  [
    '\\u001b\\][^\\u0007\\u001b]*(?:\\u0007|\\u001b\\\\)', // OSC (título etc.)
    '\\u001b\\[[0-?]*[ -/]*[@-~]', // CSI (cursor, cores, limpar)
    '\\u001b[PX^_][^\\u001b]*\\u001b\\\\', // DCS/SOS/PM/APC
    '\\u001b[@-Z\\\\-_]', // ESC de 2 bytes
    '[\\u0000-\\u0008\\u000b-\\u001f\\u007f]', // outros controles (mantém \\t e \\n)
  ].join('|'),
  'g',
)

export function hasMeaningfulOutput(data: string): boolean {
  return data.replace(ANSI, '').trim().length > 0
}

export class StatusDetector {
  private status: AgentStatus = 'running'
  private lastActivity: number

  constructor(
    private readonly options: StatusDetectorOptions,
    now: number,
  ) {
    this.lastActivity = now
  }

  get current(): AgentStatus {
    return this.status
  }

  // Cada função devolve o novo status se mudou, ou null.
  output(data: string, now: number): AgentStatus | null {
    if (this.finished() || !hasMeaningfulOutput(data)) return null
    this.lastActivity = now
    return this.set('running')
  }

  tick(now: number): AgentStatus | null {
    if (this.finished() || this.status === 'waiting') return null
    return now - this.lastActivity >= this.options.idleMs ? this.set('waiting') : null
  }

  exit(code: number): AgentStatus | null {
    if (this.finished()) return null
    return this.set(code === 0 ? 'done' : 'error')
  }

  private finished(): boolean {
    return this.status === 'done' || this.status === 'error'
  }

  private set(next: AgentStatus): AgentStatus | null {
    if (next === this.status) return null
    this.status = next
    return next
  }
}
