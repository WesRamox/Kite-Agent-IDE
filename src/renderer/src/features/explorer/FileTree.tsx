import { useCallback, useMemo, useState } from 'react'
import { Tree, type NodeApi, type TreeApi } from 'react-arborist'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { useElementSize } from '../../lib/use-element-size'
import { openFile } from '../editor/editor.actions'
import { beginCreate, deleteEntry } from './explorer.actions'
import { useExplorerStore } from './explorer.store'
import { buildTree, NEW_NODE_ID, type TreeNodeData } from './tree-data'
import { TreeRow } from './TreeRow'

interface Props {
  root: string
  treeRef: React.RefObject<TreeApi<TreeNodeData> | null>
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

export function FileTree({ root, treeRef }: Props) {
  const children = useExplorerStore((s) => s.children)
  const pending = useExplorerStore((s) => s.pendingCreate)
  const load = useExplorerStore((s) => s.load)
  const startRename = useExplorerStore((s) => s.startRename)
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [menu, setMenu] = useState<MenuState | null>(null)

  const data = useMemo(() => buildTree(root, children, pending), [root, children, pending])

  const onToggle = useCallback(
    (id: string) => {
      if (id !== NEW_NODE_ID && !(id in useExplorerStore.getState().children)) void load(id)
    },
    [load],
  )

  const onActivate = useCallback((node: NodeApi<TreeNodeData>) => {
    if (node.data.kind === 'file' && !node.data.isNew) void openFile(node.data.id)
  }, [])

  const menuItems = (node: TreeNodeData | null): MenuItem[] => {
    const openDir = (dir: string) => treeRef.current?.open(dir)
    const create: MenuItem[] = [
      { label: 'Novo arquivo', onSelect: () => beginCreate(root, 'file', node, openDir) },
      { label: 'Nova pasta', onSelect: () => beginCreate(root, 'directory', node, openDir) },
    ]
    if (!node) return create
    return [
      ...create,
      { label: 'Renomear', onSelect: () => startRename(node.id) },
      {
        label: 'Mover para a lixeira',
        danger: true,
        onSelect: () => void deleteEntry(node.id, node.kind),
      },
    ]
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const node = treeRef.current?.focusedNode
    if (!node || node.data.isNew || e.target instanceof HTMLInputElement) return
    if (e.key === 'F2') {
      e.preventDefault()
      startRename(node.data.id)
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
      e.preventDefault()
      void deleteEntry(node.data.id, node.data.kind)
    }
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => {
        e.preventDefault()
        const id = (e.target as HTMLElement).closest('[data-node-id]')?.getAttribute('data-node-id')
        const node = id ? (treeRef.current?.get(id)?.data ?? null) : null
        setMenu({ x: e.clientX, y: e.clientY, items: menuItems(node) })
      }}
    >
      {size.height > 0 && (
        <Tree<TreeNodeData>
          ref={treeRef}
          data={data}
          width={size.width}
          height={size.height}
          rowHeight={24}
          indent={12}
          disableDrag
          disableDrop
          disableEdit
          disableMultiSelection
          openByDefault={false}
          onToggle={onToggle}
          onActivate={onActivate}
        >
          {TreeRow}
        </Tree>
      )}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
