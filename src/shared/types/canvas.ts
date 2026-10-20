// Quadro (estilo n8n): blocos ligados por linhas, um quadro por pasta aberta.

// Cores que a pessoa pode dar a um bloco (tokens do tema).
export type CanvasNodeColor = 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'merged'

// O que cada bloco mostra: o terminal de um agente, um terminal comum, uma página da web, uma
// nota, o resumo de uma tarefa ou um código (de um arquivo, ou escrito ali mesmo). Todo bloco
// pode ter um nome e uma cor escolhidos pela pessoa.
export type CanvasNodeData = { label?: string; color?: CanvasNodeColor } & (
  | { kind: 'agent'; agentId: string }
  | { kind: 'terminal'; cwd: string }
  | { kind: 'browser'; url: string }
  // `text` é o texto simples (o que o agente lê e escreve); `html` é a versão formatada, só para
  // a tela. Sem `html` (nota antiga, ou o agente escreveu nela), vale o `text`.
  | { kind: 'note'; text: string; html?: string }
  | { kind: 'summary'; taskId: string }
  | { kind: 'code'; path?: string; text?: string; language?: string }
)

export type CanvasNodeKind = CanvasNodeData['kind']

export interface CanvasNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  data: CanvasNodeData
}

// Lado do bloco em que a ligação encosta. Sem lado (quadros antigos): sai pela direita e entra
// pela esquerda.
export type CanvasHandleSide = 'top' | 'right' | 'bottom' | 'left'

export interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: CanvasHandleSide
  targetHandle?: CanvasHandleSide
}

export interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: { x: number; y: number; zoom: number }
}

// Um workflow salvo: um quadro com nome. Cada pasta aberta tem os seus e lembra qual estava aberto.
export interface CanvasBoard {
  id: string
  name: string
  state: CanvasState
}

export interface WorkspaceCanvas {
  active: string
  boards: CanvasBoard[]
}

// Ferramentas do quadro para os agentes (servidor MCP do Kite). O agente só alcança os blocos
// ligados ao bloco dele. `caller` diz quem chamou: "agent:<id do agente>" ou "node:<id do bloco>".
export type CanvasToolName = 'list' | 'read' | 'write' | 'send' | 'navigate' | 'screenshot'

export interface CanvasToolCall {
  requestId: string
  tool: CanvasToolName
  args: { block?: string; text?: string; mode?: 'replace' | 'append'; url?: string }
  caller: string
}

export type CanvasToolContent =
  { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' }

export type CanvasToolResult =
  { ok: true; content: CanvasToolContent[] } | { ok: false; message: string }
