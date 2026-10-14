import { describe, expect, it } from 'vitest'
import { buildTree, NEW_NODE_ID } from './tree-data'

const children = {
  '/r': [
    { name: 'src', path: '/r/src', kind: 'directory' as const },
    { name: 'a.ts', path: '/r/a.ts', kind: 'file' as const },
  ],
  '/r/src': [{ name: 'b.ts', path: '/r/src/b.ts', kind: 'file' as const }],
}

describe('buildTree', () => {
  it('aninha pastas carregadas e marca folhas com null', () => {
    const tree = buildTree('/r', children, null)
    expect(tree.map((n) => n.id)).toEqual(['/r/src', '/r/a.ts'])
    expect(tree[0]?.children?.map((n) => n.id)).toEqual(['/r/src/b.ts'])
    expect(tree[1]?.children).toBeNull()
  })

  it('pasta não carregada vira lista vazia (expansível)', () => {
    const tree = buildTree('/r', { '/r': children['/r'] }, null)
    expect(tree[0]?.children).toEqual([])
  })

  it('insere o nó de criação na posição certa', () => {
    const file = buildTree('/r', children, { parent: '/r', kind: 'file' })
    expect(file.map((n) => n.id)).toEqual(['/r/src', NEW_NODE_ID, '/r/a.ts'])
    const dir = buildTree('/r', children, { parent: '/r/src', kind: 'directory' })
    expect(dir[0]?.children?.[0]?.id).toBe(NEW_NODE_ID)
  })
})
