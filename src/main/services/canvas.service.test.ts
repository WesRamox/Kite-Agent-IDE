import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CanvasState, WorkspaceCanvas } from '@shared/types'
import { canvasStoreSchema, EMPTY_CANVAS, workspaceCanvasSchema } from '../lib/canvas-schema'
import { JsonStore } from '../lib/json-store'
import { makeTree } from '../test/tmp'
import { CanvasService } from './canvas.service'

const node = (id: string, data: CanvasState['nodes'][number]['data']) => ({
  id,
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  data,
})

const one = (state: CanvasState, name = 'Pix'): WorkspaceCanvas => ({
  active: 'w1',
  boards: [{ id: 'w1', name, state }],
})

describe('CanvasService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  beforeEach(async () => ({ dir, cleanup } = await makeTree({})))
  afterEach(() => cleanup())

  const svc = (roots: string[]) =>
    new CanvasService({
      guard: { isRoot: (r) => roots.includes(r) },
      store: new JsonStore(path.join(dir, 'canvas.json'), canvasStoreSchema, { workspaces: {} }),
    })

  it('pasta nova começa com um workflow vazio; cada pasta guarda os seus', async () => {
    const s = svc(['/a', '/b'])
    await expect(s.load('/a')).resolves.toMatchObject({
      boards: [{ name: 'Meu workflow', state: EMPTY_CANVAS }],
    })
    const a: WorkspaceCanvas = {
      active: 'w2',
      boards: [
        {
          id: 'w1',
          name: 'Pix',
          state: { ...EMPTY_CANVAS, nodes: [node('n1', { kind: 'note', text: 'oi' })] },
        },
        { id: 'w2', name: 'Estorno', state: EMPTY_CANVAS },
      ],
    }
    await Promise.all([s.save('/a', a), s.save('/b', one(EMPTY_CANVAS, 'Outro'))])
    await expect(svc(['/a']).load('/a')).resolves.toEqual(a)
    await expect(svc(['/b']).load('/b')).resolves.toEqual(one(EMPTY_CANVAS, 'Outro'))
  })

  it('descarta ligações soltas e corrige o workflow aberto que não existe', async () => {
    const s = svc(['/a'])
    await s.save('/a', {
      active: 'sumiu',
      boards: [
        {
          id: 'w1',
          name: 'Pix',
          state: {
            nodes: [node('n1', { kind: 'note', text: '' }), node('n2', { kind: 'note', text: '' })],
            edges: [
              { id: 'e1', source: 'n1', target: 'n2' },
              { id: 'e2', source: 'n1', target: 'sumiu' },
              { id: 'e3', source: 'n2', target: 'n2' },
            ],
            viewport: EMPTY_CANVAS.viewport,
          },
        },
      ],
    })
    const loaded = await s.load('/a')
    expect(loaded.active).toBe('w1')
    expect(loaded.boards[0]?.state.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('recusa pasta que não está aberta', async () => {
    await expect(svc([]).load('/fora')).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
    await expect(svc([]).save('/fora', one(EMPTY_CANVAS))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })

  it('o navegador do quadro só abre http(s), e workflow precisa de nome', () => {
    const valid = (canvas: unknown) => workspaceCanvasSchema.safeParse(canvas).success
    const browser = (url: string) =>
      one({
        nodes: [node('n', { kind: 'browser', url })],
        edges: [],
        viewport: EMPTY_CANVAS.viewport,
      })
    expect(valid(browser('http://localhost:3001'))).toBe(true)
    expect(valid(browser('https://exemplo.com'))).toBe(true)
    expect(valid(browser('file:///etc/passwd'))).toBe(false)
    expect(valid(browser('javascript:alert(1)'))).toBe(false)
    const terminal = (cwd: string) =>
      one({
        nodes: [node('t', { kind: 'terminal', cwd })],
        edges: [],
        viewport: EMPTY_CANVAS.viewport,
      })
    expect(valid(terminal('/repo/.worktrees/PAY-412'))).toBe(true)
    expect(valid(terminal(''))).toBe(false)
    expect(valid(one(EMPTY_CANVAS, '   '))).toBe(false)
    expect(valid({ active: 'w1', boards: [] })).toBe(false)
  })
})
