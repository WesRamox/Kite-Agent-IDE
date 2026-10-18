import { FilePlus, FolderOpen, FolderPlus, ListCollapse, RefreshCw } from 'lucide-react'
import { useRef } from 'react'
import type { TreeApi } from 'react-arborist'
import { openFolder } from '../../app/workspace.actions'
import { basename } from '../../lib/paths'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { beginCreate } from './explorer.actions'
import { useExplorerStore } from './explorer.store'
import { FileTree } from './FileTree'
import { TaskExplorer } from '../tasks/TaskExplorer'
import { WorkspaceSwitcher } from '../tasks/WorkspaceSwitcher'
import { useTasksStore } from '../tasks/tasks.store'
import type { TreeNodeData } from './tree-data'
import { useT } from '../../lib/i18n'

function IconButton(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg"
    >
      {props.children}
    </button>
  )
}

export function ExplorerPanel() {
  const root = useWorkspaceStore((s) => s.root)
  const taskOpen = useTasksStore((s) => s.activeTaskId !== null)
  const t = useT()
  const treeRef = useRef<TreeApi<TreeNodeData> | null>(null)

  if (root && taskOpen) return <TaskExplorer />

  if (!root) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-fg-muted">
        <p>{t('explorer.noFolder')}</p>
        <button
          type="button"
          onClick={() => void openFolder()}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:bg-accent/85"
        >
          <FolderOpen size={14} /> {t('explorer.openFolder')}
        </button>
      </div>
    )
  }

  const explorer = useExplorerStore.getState
  const createAtSelection = (kind: 'file' | 'directory') => {
    const node = treeRef.current?.focusedNode?.data
    beginCreate(root, kind, node && !node.isNew ? node : null, (dir) => treeRef.current?.open(dir))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceSwitcher />
      <div className="group flex h-8 items-center gap-0.5 px-3.5">
        <span className="flex-1 truncate text-[11px] font-semibold tracking-[0.08em] text-fg uppercase">
          {basename(root)}
        </span>
        <IconButton label={t('explorer.newFile')} onClick={() => createAtSelection('file')}>
          <FilePlus size={14} />
        </IconButton>
        <IconButton label={t('explorer.newFolder')} onClick={() => createAtSelection('directory')}>
          <FolderPlus size={14} />
        </IconButton>
        <IconButton
          label={t('explorer.refresh')}
          onClick={() => void explorer().refresh(Object.keys(explorer().children))}
        >
          <RefreshCw size={14} />
        </IconButton>
        <IconButton label={t('explorer.collapseAll')} onClick={() => treeRef.current?.closeAll()}>
          <ListCollapse size={14} />
        </IconButton>
      </div>
      <FileTree root={root} treeRef={treeRef} />
    </div>
  )
}
