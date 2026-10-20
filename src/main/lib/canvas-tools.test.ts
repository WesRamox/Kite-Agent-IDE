import { describe, expect, it } from 'vitest'
import { fromMcpCall, MCP_TOOLS, mcpConfig, toMcpResult } from './canvas-tools'
import { toolResultSchema } from './canvas-tools-schema'

describe('canvas-tools', () => {
  it('traduz a chamada do agente (em português) para o pedido ao Kite', () => {
    expect(
      fromMcpCall('quadro_escrever', { bloco: 'n1', texto: 'oi', modo: 'acrescentar' }, 'agent:a1'),
    ).toEqual({
      tool: 'write',
      caller: 'agent:a1',
      args: { block: 'n1', text: 'oi', mode: 'append' },
    })
    expect(fromMcpCall('quadro_navegar', { bloco: 'b', endereco: '3001' }, 'node:t1')).toEqual({
      tool: 'navigate',
      caller: 'node:t1',
      args: { block: 'b', url: '3001' },
    })
    expect(fromMcpCall('quadro_blocos', undefined, 'node:t1')?.tool).toBe('list')
  })

  it('recusa ferramenta desconhecida, quem chama malformado e texto grande demais', () => {
    expect(fromMcpCall('apagar_tudo', {}, 'agent:a1')).toBeNull()
    expect(fromMcpCall('quadro_blocos', {}, 'qualquer coisa')).toBeNull()
    expect(fromMcpCall('quadro_blocos', {}, 'node:../../etc')).toBeNull()
    expect(
      fromMcpCall('quadro_enviar', { bloco: 'b', texto: 'x'.repeat(100_001) }, 'node:t'),
    ).toBeNull()
  })

  it('toda ferramenta anunciada tem nome, descrição e esquema de entrada', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.name).toMatch(/^quadro_/)
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('erro do Kite vira resultado de erro do MCP; resposta do renderer é validada', () => {
    expect(toMcpResult({ ok: false, message: 'não ligado' })).toEqual({
      content: [{ type: 'text', text: 'não ligado' }],
      isError: true,
    })
    expect(
      toolResultSchema.safeParse({
        ok: true,
        content: [{ type: 'image', data: 'x', mimeType: 'image/gif' }],
      }).success,
    ).toBe(false)
  })

  it('a configuração do --mcp-config roda o kite-mcp em modo Node e diz quem chama', () => {
    expect(
      mcpConfig(
        { exec: '/opt/Kite/kite', script: '/p/kite-mcp.js', socket: '/p/canvas.sock' },
        'agent:a1',
      ),
    ).toEqual({
      mcpServers: {
        kite: {
          type: 'stdio',
          command: '/opt/Kite/kite',
          args: ['/p/kite-mcp.js'],
          env: {
            ELECTRON_RUN_AS_NODE: '1',
            KITE_CANVAS_SOCKET: '/p/canvas.sock',
            KITE_CANVAS_CALLER: 'agent:a1',
          },
        },
      },
    })
  })
})
