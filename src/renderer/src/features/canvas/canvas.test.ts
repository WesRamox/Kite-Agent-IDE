import { describe, expect, it } from 'vitest'
import type { CanvasState } from '@shared/types'
import { edgeId, fromFlow, newNode, NODE_SIZE, toFlowEdges, toFlowNodes } from './canvas'

const state: CanvasState = {
  nodes: [
    { id: 'n1', x: 10, y: 20, width: 300, height: 200, data: { kind: 'note', text: 'oi' } },
    {
      id: 'n2',
      x: 400,
      y: 20,
      width: 700,
      height: 480,
      data: { kind: 'browser', url: 'http://localhost:3001/' },
    },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'bottom', targetHandle: 'top' }],
  viewport: { x: -50, y: 30, zoom: 0.9 },
}

describe('canvas', () => {
  it('ida e volta entre o quadro salvo e o React Flow não perde nada, nem o lado da ligação', () => {
    expect(fromFlow(toFlowNodes(state), toFlowEdges(state), state.viewport)).toEqual(state)
  })

  it('ligação de quadro antigo (sem lado) sai pela direita e entra pela esquerda', () => {
    const legacy: CanvasState = { ...state, edges: [{ id: 'e1', source: 'n1', target: 'n2' }] }
    expect(toFlowEdges(legacy)[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
  })

  it('lado desconhecido não vai para o disco', () => {
    const [edge] = toFlowEdges(state)
    if (!edge) throw new Error('sem ligação')
    const out = fromFlow(
      [],
      [{ ...edge, sourceHandle: 'meio', targetHandle: null }],
      state.viewport,
    )
    expect(out.edges[0]).toEqual({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      sourceHandle: undefined,
      targetHandle: undefined,
    })
  })

  it('o mesmo par de blocos pode se ligar por lados diferentes, com ids diferentes', () => {
    const base = { source: 'a', target: 'b' }
    expect(edgeId({ ...base, sourceHandle: 'right', targetHandle: 'left' })).not.toBe(
      edgeId({ ...base, sourceHandle: 'bottom', targetHandle: 'top' }),
    )
    expect(edgeId(base)).toBe(edgeId({ ...base, sourceHandle: 'right', targetHandle: 'left' }))
  })

  it('arredonda e limita o que vai para o disco', () => {
    const [n] = toFlowNodes(state)
    if (!n) throw new Error('sem bloco')
    const out = fromFlow(
      [{ ...n, position: { x: 10.6, y: 2e7 }, width: 10, height: undefined }],
      [],
      { x: 0, y: 0, zoom: 9 },
    )
    expect(out.nodes[0]).toMatchObject({
      x: 11,
      y: 1_000_000,
      width: 40,
      height: NODE_SIZE.note.height,
    })
    expect(out.viewport.zoom).toBe(4)
  })

  it('bloco novo nasce com o tamanho do tipo, selecionado e com id próprio', () => {
    const a = newNode({ kind: 'note', text: '' }, { x: 0, y: 0 })
    const b = newNode({ kind: 'note', text: '' }, { x: 0, y: 0 })
    expect(a).toMatchObject({ type: 'note', selected: true, ...NODE_SIZE.note })
    expect(a.id).not.toBe(b.id)
  })
})
