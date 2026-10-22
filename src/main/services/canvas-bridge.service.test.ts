import { readFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CanvasToolCall } from '@shared/types'
import { createLogger } from '../lib/logger'
import { makeTree } from '../test/tmp'
import { CanvasBridgeService, canvasSocketPath } from './canvas-bridge.service'

// Uma chamada como o kite-mcp faz: uma linha de pedido, uma linha de resposta.
function ask(socketPath: string, line: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write(`${line}\n`))
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.includes('\n')) {
        socket.destroy()
        resolve(JSON.parse(buffer.slice(0, buffer.indexOf('\n'))))
      }
    })
    socket.on('error', reject)
  })
}

describe('CanvasBridgeService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  let calls: CanvasToolCall[]
  let bridge: CanvasBridgeService
  beforeEach(async () => {
    ;({ dir, cleanup } = await makeTree({ 'quiet/': '' }))
    calls = []
    bridge = new CanvasBridgeService({
      socketPath: canvasSocketPath(dir, process.platform),
      configDir: path.join(dir, 'mcp'),
      server: { exec: '/opt/Kite/kite', script: '/opt/kite-mcp.js' },
      platform: 'linux',
      presets: async () => [
        { id: 'claude', name: 'Claude Code', command: 'claude', promptMode: 'arg', promptFlag: '' },
        { id: 'codex', name: 'Codex', command: 'codex', promptMode: 'arg', promptFlag: '' },
      ],
      emit: (call) => {
        calls.push(call)
        // O renderer responde a cada pedido.
        setTimeout(
          () =>
            bridge.reply(call.requestId, {
              ok: true,
              content: [{ type: 'text', text: `ok ${call.tool}` }],
            }),
          5,
        )
      },
      log: createLogger('test', 'error', () => {}),
      timeoutMs: 300,
    })
    await bridge.start()
  })
  afterEach(async () => {
    await bridge.stop()
    await cleanup()
  })

  it('leva o pedido do agente ao renderer e devolve a resposta', async () => {
    const res = await ask(
      canvasSocketPath(dir, process.platform),
      JSON.stringify({ tool: 'read', args: { block: 'n1' }, caller: 'node:t1' }),
    )
    expect(res).toEqual({ ok: true, content: [{ type: 'text', text: 'ok read' }] })
    expect(calls[0]).toMatchObject({ tool: 'read', args: { block: 'n1' }, caller: 'node:t1' })
  })

  it('recusa pedido malformado sem incomodar o renderer', async () => {
    const res = await ask(
      canvasSocketPath(dir, process.platform),
      JSON.stringify({ tool: 'rm -rf', args: {}, caller: 'node:t1' }),
    )
    expect(res).toMatchObject({ ok: false })
    expect(await ask(canvasSocketPath(dir, process.platform), 'não é json')).toMatchObject({
      ok: false,
    })
    expect(calls).toHaveLength(0)
  })

  it('sem resposta do renderer, avisa o agente em vez de travar', async () => {
    bridge.reply = () => {}
    const quiet = new CanvasBridgeService({
      socketPath: canvasSocketPath(path.join(dir, 'quiet'), process.platform),
      configDir: path.join(dir, 'mcp'),
      server: { exec: 'e', script: 's' },
      platform: 'linux',
      presets: async () => [],
      emit: () => {},
      log: createLogger('test', 'error', () => {}),
      timeoutMs: 50,
    })
    await quiet.start()
    try {
      const res = await ask(
        canvasSocketPath(path.join(dir, 'quiet'), process.platform),
        JSON.stringify({ tool: 'list', args: {}, caller: 'agent:a' }),
      )
      expect(res).toMatchObject({ ok: false })
    } finally {
      await quiet.stop()
    }
  })

  it('monta o comando do agente num terminal do quadro com as ferramentas (só no Claude Code)', async () => {
    const cmd = await bridge.launchCommand('claude', 'term-1')
    const file = path.join(dir, 'mcp', 'node_term-1.json')
    expect(cmd).toBe(`claude --mcp-config '${file}'`)
    const config = JSON.parse(await readFile(file, 'utf8'))
    expect(config.mcpServers.kite.env.KITE_CANVAS_CALLER).toBe('node:term-1')
    expect(config.mcpServers.kite.env.KITE_CANVAS_SOCKET).toBe(
      canvasSocketPath(dir, process.platform),
    )
    await expect(bridge.launchCommand('codex', 'term-1')).resolves.toBe('codex')
    await expect(bridge.launchCommand('sumiu', 'term-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
