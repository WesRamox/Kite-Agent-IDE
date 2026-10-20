import type { CanvasNodeData, CanvasNodeKind, CanvasState } from '@shared/types'
import type { Edge, Node, Viewport } from '@xyflow/react'

// Conversão entre o quadro salvo (CanvasState) e o formato do React Flow, e os tamanhos de cada
// tipo de bloco. Funções puras.

export type FlowNode = Node<CanvasNodeData, CanvasNodeKind>
export type FlowNodeOf<K extends CanvasNodeKind> = Node<Extract<CanvasNodeData, { kind: K }>, K>

export const EDGE_TYPE = 'kite'

export const NODE_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  agent: { width: 620, height: 380 },
  terminal: { width: 620, height: 360 },
  browser: { width: 760, height: 500 },
  note: { width: 280, height: 220 },
  summary: { width: 320, height: 190 },
  code: { width: 620, height: 420 },
}

export const MIN_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  agent: { width: 320, height: 180 },
  terminal: { width: 320, height: 160 },
  browser: { width: 360, height: 240 },
  note: { width: 180, height: 120 },
  summary: { width: 220, height: 120 },
  code: { width: 300, height: 180 },
}

export const DEFAULT_BROWSER_URL = 'https://www.google.com/'

// Terminal de um bloco do quadro (o registro de sessões é por id).
export const canvasSessionId = (nodeId: string) => `canvas-term:${nodeId}`

export const EMPTY_STATE: CanvasState = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }

let counter = 0
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`
}

export function newNode(
  data: CanvasNodeData,
  position: { x: number; y: number },
  size = NODE_SIZE[data.kind],
): FlowNode {
  return {
    id: newId(data.kind),
    type: data.kind,
    position,
    width: size.width,
    height: size.height,
    data,
    selected: true,
  }
}

export function edgeId(source: string, target: string): string {
  return `e-${source}-${target}`
}

export function toFlowNodes(state: CanvasState): FlowNode[] {
  return state.nodes.map((n) => ({
    id: n.id,
    type: n.data.kind,
    position: { x: n.x, y: n.y },
    width: n.width,
    height: n.height,
    data: n.data,
  }))
}

export function toFlowEdges(state: CanvasState): Edge[] {
  return state.edges.map((e) => ({ ...e, type: EDGE_TYPE }))
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)))

// O que vai para o disco: posição e tamanho arredondados, dentro dos limites do main.
export function fromFlow(nodes: FlowNode[], edges: Edge[], viewport: Viewport): CanvasState {
  return {
    nodes: nodes.map((n) => {
      const size = NODE_SIZE[n.data.kind]
      return {
        id: n.id,
        x: clamp(n.position.x, -1_000_000, 1_000_000),
        y: clamp(n.position.y, -1_000_000, 1_000_000),
        width: clamp(n.width ?? n.measured?.width ?? size.width, 40, 5000),
        height: clamp(n.height ?? n.measured?.height ?? size.height, 40, 5000),
        data: n.data,
      }
    }),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
    viewport: {
      x: clamp(viewport.x, -1_000_000, 1_000_000),
      y: clamp(viewport.y, -1_000_000, 1_000_000),
      zoom: Math.min(4, Math.max(0.05, viewport.zoom)),
    },
  }
}

// Bloco de quem chamou: "agent:<id>" é o bloco do agente; "node:<id>" é o próprio bloco (um
// terminal do quadro onde o agente foi iniciado).
export function findCaller(caller: string, nodes: FlowNode[]): FlowNode | undefined {
  const [kind, id] = [caller.slice(0, caller.indexOf(':')), caller.slice(caller.indexOf(':') + 1)]
  if (kind === 'node') return nodes.find((n) => n.id === id)
  return nodes.find((n) => n.data.kind === 'agent' && n.data.agentId === id)
}

export function linkedTo(
  id: string,
  nodes: FlowNode[],
  edges: { source: string; target: string }[],
) {
  const ids = new Set(
    edges.flatMap((e) => (e.source === id ? [e.target] : e.target === id ? [e.source] : [])),
  )
  return nodes.filter((n) => ids.has(n.id))
}
