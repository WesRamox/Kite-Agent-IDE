// Servidor MCP (stdio) que o Claude Code abre quando o Kite inicia um agente com
// `--mcp-config`. Dá ao agente as ferramentas do quadro (blocos ligados a ele). Roda com o
// binário do Kite em modo Node e repassa cada chamada ao Kite aberto pelo socket local.
// Regras: o stdout é só do protocolo (uma mensagem JSON por linha); nada de log nele.
import net from 'node:net'
import { fromMcpCall, MCP_TOOLS, toMcpResult } from '../lib/canvas-tools'

const SOCKET = process.env['KITE_CANVAS_SOCKET'] ?? ''
const CALLER = process.env['KITE_CANVAS_CALLER'] ?? ''
const TIMEOUT_MS = 90_000
const MAX_LINE = 25 * 1024 * 1024

interface Message {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const send = (msg: object): void => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`)
}
const textResult = (text: string) => ({ content: [{ type: 'text', text }], isError: true })

// Uma chamada ao Kite: uma linha de pedido, uma linha de resposta.
function callKite(request: object): Promise<unknown> {
  return new Promise((resolve) => {
    if (!SOCKET)
      return resolve(textResult('O Kite não passou o caminho do quadro para este agente.'))
    const socket = net.createConnection(SOCKET)
    let buffer = ''
    const done = (value: unknown) => {
      clearTimeout(timer)
      socket.destroy()
      resolve(value)
    }
    const timer = setTimeout(
      () => done(textResult('O Kite demorou demais para responder.')),
      TIMEOUT_MS,
    )
    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write(`${JSON.stringify(request)}\n`))
    socket.on('data', (chunk: string) => {
      buffer += chunk
      const end = buffer.indexOf('\n')
      if (end < 0) return
      try {
        done(toMcpResult(JSON.parse(buffer.slice(0, end)) as Parameters<typeof toMcpResult>[0]))
      } catch {
        done(textResult('Resposta inválida do Kite.'))
      }
    })
    socket.on('error', () =>
      done(textResult('O Kite não está aberto (ou o quadro não está disponível).')),
    )
  })
}

async function handle(msg: Message): Promise<void> {
  const { id, method, params } = msg
  if (id === undefined || id === null) return // notificação: não tem resposta
  if (method === 'initialize') {
    const version =
      typeof params?.['protocolVersion'] === 'string' ? params['protocolVersion'] : '2025-06-18'
    return send({
      id,
      result: {
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: { name: 'kite', version: '1' },
        instructions:
          'Ferramentas do quadro do Kite. Você alcança só os blocos ligados ao seu bloco no quadro; use quadro_blocos para ver quais são.',
      },
    })
  }
  if (method === 'ping') return send({ id, result: {} })
  if (method === 'tools/list') {
    return send({
      id,
      result: {
        tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      },
    })
  }
  if (method === 'tools/call') {
    const request = fromMcpCall(String(params?.['name'] ?? ''), params?.['arguments'], CALLER)
    const result = request
      ? await callKite(request)
      : textResult('Ferramenta ou argumentos inválidos.')
    return send({ id, result })
  }
  send({ id, error: { code: -32601, message: `Método desconhecido: ${String(method)}` } })
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => {
  input += chunk
  if (input.length > MAX_LINE) input = ''
  let end = input.indexOf('\n')
  while (end >= 0) {
    const line = input.slice(0, end).trim()
    input = input.slice(end + 1)
    if (line) {
      try {
        void handle(JSON.parse(line) as Message)
      } catch {
        send({ id: null, error: { code: -32700, message: 'JSON inválido' } })
      }
    }
    end = input.indexOf('\n')
  }
})
process.stdin.on('end', () => process.exit(0))
