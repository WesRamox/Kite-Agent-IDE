import { randomUUID } from 'node:crypto'
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import type { AgentPreset, CanvasToolCall, CanvasToolResult } from '@shared/types'
import { agentCommandLine, withKiteTools } from '../lib/agent-command'
import { mcpConfig } from '../lib/canvas-tools'
import { bridgeRequestSchema } from '../lib/canvas-tools-schema'
import { AppException } from '../lib/errors'
import { t } from '../lib/i18n'
import type { Logger } from '../lib/logger'

export interface CanvasBridgeServiceDeps {
  // Socket local (Unix) ou pipe nomeado (Windows) onde o kite-mcp chama o Kite.
  socketPath: string
  // Pasta onde ficam as configurações do --mcp-config, uma por agente ou bloco.
  configDir: string
  // Binário e script do kite-mcp.
  server: { exec: string; script: string }
  platform: string
  presets: () => Promise<AgentPreset[]>
  // Leva o pedido ao renderer (que conhece os blocos vivos); a resposta volta por reply().
  emit: (call: CanvasToolCall) => void
  log: Logger
  timeoutMs?: number
}

const MAX_REQUEST = 256 * 1024

// Ponte entre o servidor MCP que os agentes usam e o quadro: recebe pedidos pelo socket, pergunta
// ao renderer e devolve a resposta. Também monta o comando que inicia um agente com acesso a ela.
export class CanvasBridgeService {
  private server: net.Server | null = null
  private readonly pending = new Map<
    string,
    { resolve: (r: CanvasToolResult) => void; timer: ReturnType<typeof setTimeout> }
  >()

  constructor(private readonly deps: CanvasBridgeServiceDeps) {}

  async start(): Promise<void> {
    const { socketPath } = this.deps
    // Socket de uma execução anterior que caiu: o arquivo fica para trás.
    if (!socketPath.startsWith('\\\\')) rmSync(socketPath, { force: true })
    const server = net.createServer((socket) => this.serve(socket))
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(socketPath, () => resolve())
    })
    if (!socketPath.startsWith('\\\\')) chmodSync(socketPath, 0o600)
    this.server = server
  }

  async stop(): Promise<void> {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer)
      p.resolve({ ok: false, message: t('canvas.tool.closed') })
      this.pending.delete(id)
    }
    const server = this.server
    this.server = null
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  // Resposta do renderer a um pedido.
  reply(requestId: string, result: CanvasToolResult): void {
    const p = this.pending.get(requestId)
    if (!p) return
    clearTimeout(p.timer)
    this.pending.delete(requestId)
    p.resolve(result)
  }

  // Arquivo do --mcp-config para quem vai chamar ("agent:<id>" ou "node:<id>").
  configFile(caller: string): string {
    mkdirSync(this.deps.configDir, { recursive: true, mode: 0o700 })
    const file = path.join(this.deps.configDir, `${caller.replace(/[^\w-]/g, '_')}.json`)
    const config = mcpConfig({ ...this.deps.server, socket: this.deps.socketPath }, caller)
    writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 })
    return file
  }

  // Comando que inicia o agente do preset num terminal do quadro, já com as ferramentas do quadro
  // (só o Claude Code entende o --mcp-config; os outros vão sem).
  async launchCommand(presetId: string, nodeId: string): Promise<string> {
    const preset = (await this.deps.presets()).find((p) => p.id === presetId)
    if (!preset) throw new AppException('NOT_FOUND', t('error.presetNotFound'))
    const windows = this.deps.platform === 'win32'
    return withKiteTools(
      agentCommandLine(preset, '', windows),
      preset,
      this.configFile(`node:${nodeId}`),
      windows,
    )
  }

  private serve(socket: net.Socket): void {
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('error', () => socket.destroy())
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.length > MAX_REQUEST) return void socket.destroy()
      const end = buffer.indexOf('\n')
      if (end < 0) return
      const line = buffer.slice(0, end)
      buffer = ''
      void this.answer(line).then((result) => {
        if (!socket.destroyed) socket.end(`${JSON.stringify(result)}\n`)
      })
    })
  }

  private async answer(line: string): Promise<CanvasToolResult> {
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      return { ok: false, message: t('canvas.tool.badRequest') }
    }
    const parsed = bridgeRequestSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, message: t('canvas.tool.badRequest') }
    const requestId = randomUUID()
    this.deps.log.debug('ferramenta do quadro', { tool: parsed.data.tool })
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        resolve({ ok: false, message: t('canvas.tool.timeout') })
      }, this.deps.timeoutMs ?? 60_000)
      this.pending.set(requestId, { resolve, timer })
      this.deps.emit({ requestId, ...parsed.data })
    })
  }
}

// Onde o socket fica: na pasta de perfil (só o próprio usuário acessa); no Windows, um pipe com
// nome derivado dela.
export function canvasSocketPath(userData: string, platform: string): string {
  if (platform !== 'win32') return path.join(userData, 'canvas.sock')
  let hash = 0
  for (const ch of userData) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return `\\\\.\\pipe\\kite-canvas-${hash.toString(16)}`
}
