import type { CanvasToolCall, CanvasToolResult } from '@shared/types'

// Ferramentas que o Kite oferece aos agentes pelo servidor MCP (kite-mcp). Nomes e argumentos em
// português, para o modelo; dentro do Kite viram um CanvasToolCall. Só alcançam os blocos ligados
// ao bloco do próprio agente no quadro: ligar um bloco no agente é dar acesso a ele.
const BLOCK = { type: 'string', description: 'Id do bloco, como aparece em quadro_blocos.' }

export const MCP_TOOLS = [
  {
    name: 'quadro_blocos',
    tool: 'list',
    description:
      'Lista os blocos do quadro do Kite ligados a você (notas, navegador, terminais, código, resumo da tarefa e outros agentes), com o id e um resumo de cada um. Comece por aqui.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'quadro_ler',
    tool: 'read',
    description:
      'Lê um bloco ligado a você: o texto da nota, o código, o resumo da tarefa, o fim da saída de um terminal ou agente, ou o endereço, o título e o texto da página do navegador.',
    inputSchema: {
      type: 'object',
      properties: { bloco: BLOCK },
      required: ['bloco'],
      additionalProperties: false,
    },
  },
  {
    name: 'quadro_escrever',
    tool: 'write',
    description:
      'Escreve numa nota ou num bloco de código ligado a você. Bloco de código ligado a um arquivo é salvo no arquivo.',
    inputSchema: {
      type: 'object',
      properties: {
        bloco: BLOCK,
        texto: { type: 'string' },
        modo: { type: 'string', enum: ['substituir', 'acrescentar'], default: 'substituir' },
      },
      required: ['bloco', 'texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'quadro_enviar',
    tool: 'send',
    description:
      'Digita um texto e aperta Enter num terminal ou num outro agente ligado a você: roda um comando no terminal, ou passa uma instrução para o outro agente (um subagente).',
    inputSchema: {
      type: 'object',
      properties: { bloco: BLOCK, texto: { type: 'string' } },
      required: ['bloco', 'texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'quadro_navegar',
    tool: 'navigate',
    description:
      'Abre um endereço (ou pesquisa um texto) no navegador ligado a você. Aceita sites e telas locais, como localhost:3000.',
    inputSchema: {
      type: 'object',
      properties: { bloco: BLOCK, endereco: { type: 'string' } },
      required: ['bloco', 'endereco'],
      additionalProperties: false,
    },
  },
  {
    name: 'quadro_print',
    tool: 'screenshot',
    description: 'Tira um print da página aberta no navegador ligado a você.',
    inputSchema: {
      type: 'object',
      properties: { bloco: BLOCK },
      required: ['bloco'],
      additionalProperties: false,
    },
  },
] as const

const CALLER = /^(agent|node):[\w.:-]{1,200}$/
const LIMITS = { bloco: 200, texto: 100_000, endereco: 4000 } as const

export type BridgeRequest = Omit<CanvasToolCall, 'requestId'>

// Chamada MCP → pedido ao Kite; null se a ferramenta não existe ou os argumentos não servem.
// Roda no kite-mcp, fora do app (sem dependências); o Kite valida de novo ao receber.
export function fromMcpCall(name: string, args: unknown, caller: string): BridgeRequest | null {
  const def = MCP_TOOLS.find((t) => t.name === name)
  if (!def || !CALLER.test(caller)) return null
  const a = typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const out: BridgeRequest['args'] = {}
  for (const [key, field] of [
    ['bloco', 'block'],
    ['texto', 'text'],
    ['endereco', 'url'],
  ] as const) {
    const value = a[key]
    if (value === undefined) continue
    if (typeof value !== 'string' || value.length > LIMITS[key]) return null
    out[field] = value
  }
  if (a['modo'] === 'acrescentar') out.mode = 'append'
  else if (a['modo'] === 'substituir') out.mode = 'replace'
  return { tool: def.tool, caller, args: out }
}

// Resultado do Kite → resposta de tools/call do MCP.
export function toMcpResult(result: CanvasToolResult): { content: unknown[]; isError?: true } {
  return result.ok
    ? { content: result.content }
    : { content: [{ type: 'text', text: result.message }], isError: true }
}

// Configuração para o `claude --mcp-config`: o servidor de ferramentas do Kite, rodando com o
// binário do próprio Kite em modo Node, sabendo quem chama.
export function mcpConfig(
  server: { exec: string; script: string; socket: string },
  caller: string,
): object {
  return {
    mcpServers: {
      kite: {
        type: 'stdio',
        command: server.exec,
        args: [server.script],
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          KITE_CANVAS_SOCKET: server.socket,
          KITE_CANVAS_CALLER: caller,
        },
      },
    },
  }
}
