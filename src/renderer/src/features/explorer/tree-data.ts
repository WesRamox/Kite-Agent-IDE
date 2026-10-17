import type { DirEntry } from '@shared/types'
import type { PendingCreate } from './explorer.store'

export const NEW_NODE_ID = '\0new'

export interface TreeNodeData {
  id: string
  name: string
  kind: 'file' | 'directory'
  // null = folha; [] = pasta ainda não carregada (ou vazia).
  children: TreeNodeData[] | null
  isNew?: boolean
  // Raiz de uma worktree na árvore da tarefa: nome do repo em negrito e um selo (branch).
  isRoot?: boolean
  badge?: string
}

export interface ForestRoot {
  path: string
  name: string
  badge: string
}

// Monta os dados do react-arborist a partir das pastas carregadas.
export function buildTree(
  root: string,
  children: Record<string, DirEntry[]>,
  pending: PendingCreate | null,
): TreeNodeData[] {
  const build = (dir: string): TreeNodeData[] => {
    const nodes: TreeNodeData[] = (children[dir] ?? []).map((e) => ({
      id: e.path,
      name: e.name,
      kind: e.kind,
      children: e.kind === 'directory' ? build(e.path) : null,
    }))
    if (pending?.parent === dir) {
      const node: TreeNodeData = {
        id: NEW_NODE_ID,
        name: '',
        kind: pending.kind,
        children: pending.kind === 'directory' ? [] : null,
        isNew: true,
      }
      // Pastas novas no topo; arquivos novos depois das pastas.
      const at = pending.kind === 'directory' ? 0 : nodes.findIndex((n) => n.kind === 'file')
      nodes.splice(at === -1 ? nodes.length : at, 0, node)
    }
    return nodes
  }
  return build(root)
}

// Árvore da tarefa: arquivos soltos da pasta da tarefa (ex.: TASK.md) e uma raiz por worktree.
export function buildForest(
  roots: ForestRoot[],
  looseFiles: DirEntry[],
  children: Record<string, DirEntry[]>,
  pending: PendingCreate | null,
): TreeNodeData[] {
  const loose: TreeNodeData[] = looseFiles.map((e) => ({
    id: e.path,
    name: e.name,
    kind: e.kind,
    children: null,
  }))
  const trees: TreeNodeData[] = roots.map((r) => ({
    id: r.path,
    name: r.name,
    kind: 'directory',
    isRoot: true,
    badge: r.badge,
    children: buildTree(r.path, children, pending),
  }))
  return [...loose, ...trees]
}
