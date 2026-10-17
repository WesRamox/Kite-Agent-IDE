import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import type { PtyCreateOptions, PtyDataEvent, PtyExitEvent } from '@shared/types'
import { AppException } from '../lib/errors'
import type { Logger } from '../lib/logger'
import { terminalEnv, type ShellSpec } from '../lib/shell'
import type { WorkspaceGuard } from '../lib/workspace-guard'

// Subconjunto do IPty do node-pty usado aqui (injetado para testes).
export interface PtyProcess {
  readonly pid: number
  onData(listener: (data: string) => void): unknown
  onExit(listener: (e: { exitCode: number; signal?: number }) => void): unknown
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
}

export type SpawnFn = (
  file: string,
  args: string[],
  options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> },
) => PtyProcess

export interface PtyServiceDeps {
  guard: WorkspaceGuard
  spawn: SpawnFn
  shell: ShellSpec
  // Shells que o renderer pode pedir explicitamente (além do padrão).
  allowedShells: () => Promise<string[]>
  baseEnv: Record<string, string | undefined>
  emitData: (event: PtyDataEvent) => void
  emitExit: (event: PtyExitEvent) => void
  log: Logger
  // Intervalo para agrupar a saída antes de enviar ao renderer.
  flushMs?: number
}

interface Session {
  proc: PtyProcess
  buffer: string
  timer: ReturnType<typeof setTimeout> | null
  // Caracteres já emitidos (offset do fim do último evento).
  emitted: number
}

export interface SpawnSpec {
  cwd: string
  file: string
  args: string[]
  cols: number
  rows: number
  env?: Record<string, string>
}

export class PtyService {
  private readonly sessions = new Map<string, Session>()

  constructor(private readonly deps: PtyServiceDeps) {}

  async create(options: PtyCreateOptions): Promise<{ id: string; pid: number }> {
    const cwd = await this.deps.guard.resolveExisting(options.cwd)
    if (!(await stat(cwd)).isDirectory()) throw new AppException('NOT_FOUND', 'cwd não é uma pasta')

    let shell = this.deps.shell
    if (options.shell && options.shell !== shell.file) {
      if (!(await this.deps.allowedShells()).includes(options.shell)) {
        throw new AppException('FORBIDDEN_PATH', 'Shell não permitido')
      }
      shell = { file: options.shell, args: [] }
    }

    return this.spawnAt({
      cwd,
      file: shell.file,
      args: shell.args,
      cols: options.cols,
      rows: options.rows,
      env: options.env,
    })
  }

  // Inicia um processo num PTY sem validar o cwd contra as pastas abertas. Uso interno do main
  // (agentes em worktrees criadas pelo próprio app); nunca exposto direto ao renderer.
  spawnAt(spec: SpawnSpec): { id: string; pid: number } {
    const id = randomUUID()
    const proc = this.deps.spawn(spec.file, spec.args, {
      name: 'xterm-256color',
      cols: spec.cols,
      rows: spec.rows,
      cwd: spec.cwd,
      // KITE_PTY_ID chega aos hooks de um agente rodado neste terminal (Fase 7: ir até a aba).
      env: terminalEnv(this.deps.baseEnv, { ...spec.env, KITE_PTY_ID: id }),
    })
    const session: Session = { proc, buffer: '', timer: null, emitted: 0 }
    this.sessions.set(id, session)

    proc.onData((data) => this.buffer(id, session, data))
    proc.onExit(({ exitCode }) => {
      this.flush(id, session)
      this.sessions.delete(id)
      this.deps.emitExit({ id, exitCode })
    })
    this.deps.log.info('pty criado', { pid: proc.pid })
    return { id, pid: proc.pid }
  }

  has(id: string): boolean {
    return this.sessions.has(id)
  }

  write(id: string, data: string): void {
    this.get(id).proc.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.get(id).proc.resize(cols, rows)
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    if (session.timer) clearTimeout(session.timer)
    this.safeKill(session.proc)
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }

  count(): number {
    return this.sessions.size
  }

  private get(id: string): Session {
    const session = this.sessions.get(id)
    if (!session) throw new AppException('NOT_FOUND', 'Terminal não encontrado')
    return session
  }

  // Agrupa rajadas de saída (ex.: logs de build) em menos mensagens IPC.
  private buffer(id: string, session: Session, data: string): void {
    session.buffer += data
    if (!session.timer) {
      session.timer = setTimeout(() => this.flush(id, session), this.deps.flushMs ?? 5)
    }
  }

  private flush(id: string, session: Session): void {
    if (session.timer) clearTimeout(session.timer)
    session.timer = null
    if (session.buffer.length === 0) return
    const data = session.buffer
    session.buffer = ''
    session.emitted += data.length
    this.deps.emitData({ id, data, end: session.emitted })
  }

  private safeKill(proc: PtyProcess): void {
    try {
      proc.kill()
    } catch (err) {
      this.deps.log.warn('falha ao encerrar pty', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
