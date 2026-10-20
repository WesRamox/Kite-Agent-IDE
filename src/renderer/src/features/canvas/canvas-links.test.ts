import { describe, expect, it } from 'vitest'
import { findCaller, linkedTo, type FlowNode } from './canvas'

const node = (id: string, data: FlowNode['data']): FlowNode => ({
  id,
  type: data.kind,
  position: { x: 0, y: 0 },
  data,
})

describe('canvas-tools', () => {
  const nodes = [
    node('ag', { kind: 'agent', agentId: 'a1' }),
    node('term', { kind: 'terminal', cwd: '/r' }),
    node('nota', { kind: 'note', text: 'x' }),
    node('solta', { kind: 'note', text: 'y' }),
  ]
  const edges = [
    { source: 'ag', target: 'nota' },
    { source: 'term', target: 'ag' },
  ]

  it('acha o bloco de quem chamou: pelo agente ou pelo próprio bloco do terminal', () => {
    expect(findCaller('agent:a1', nodes)?.id).toBe('ag')
    expect(findCaller('node:term', nodes)?.id).toBe('term')
    expect(findCaller('agent:outro', nodes)).toBeUndefined()
  })

  it('o agente só alcança o que está ligado nele, nos dois sentidos da linha', () => {
    expect(linkedTo('ag', nodes, edges).map((n) => n.id)).toEqual(['term', 'nota'])
    expect(linkedTo('term', nodes, edges).map((n) => n.id)).toEqual(['ag'])
  })
})
