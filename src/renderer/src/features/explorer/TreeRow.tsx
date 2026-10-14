import { ChevronRight } from 'lucide-react'
import type { NodeRendererProps } from 'react-arborist'
import { useEditorStore } from '../editor/editor.store'
import { displayKind, KIND_COLOR, KIND_LABEL, KIND_LETTER } from '../git/git-format'
import { useGitStore } from '../git/git.store'
import { createEntry, renameEntry } from './explorer.actions'
import { useExplorerStore } from './explorer.store'
import { FileIcon } from './FileIcon'
import { InlineInput } from './InlineInput'
import type { TreeNodeData } from './tree-data'

export function TreeRow({ node, style, dragHandle }: NodeRendererProps<TreeNodeData>) {
  const { data } = node
  const pending = useExplorerStore((s) => s.pendingCreate)
  const renaming = useExplorerStore((s) => s.renaming === data.id)
  const stopEditing = useExplorerStore((s) => s.stopEditing)
  const dirty = useEditorStore((s) => s.tabs[data.id]?.dirty ?? false)
  const active = useEditorStore((s) => s.activePath === data.id)
  const change = useGitStore((s) => s.byPath.get(data.id))
  const dirHasChanges = useGitStore((s) => s.changedDirs.has(data.id))
  const kind = change ? displayKind(change) : null
  const gitColor = kind ? KIND_COLOR[kind] : dirHasChanges ? 'text-warning/80' : ''

  const isDir = data.kind === 'directory'
  const editing = data.isNew || renaming

  return (
    <div
      ref={dragHandle}
      style={style}
      data-node-id={data.isNew ? undefined : data.id}
      onClick={() => isDir && !editing && node.toggle()}
      className={`flex h-full cursor-pointer items-center gap-1 pr-2 ${
        node.isSelected
          ? 'bg-accent/25 text-fg'
          : active
            ? 'bg-surface-3/70 text-fg'
            : 'text-fg/90 hover:bg-surface-2'
      } ${node.isFocused ? 'outline outline-1 -outline-offset-1 outline-accent/60' : ''}`}
    >
      <ChevronRight
        size={14}
        className={`shrink-0 text-fg-muted transition-transform ${
          isDir ? '' : 'invisible'
        } ${node.isOpen ? 'rotate-90' : ''}`}
      />
      <FileIcon name={data.name} kind={data.kind} open={node.isOpen} />
      {editing ? (
        <InlineInput
          initial={data.isNew ? '' : data.name}
          onCancel={stopEditing}
          onSubmit={(value) =>
            data.isNew && pending
              ? void createEntry(pending.parent, pending.kind, value)
              : void renameEntry(data.id, value)
          }
        />
      ) : (
        <span className={`truncate ${dirty ? 'italic' : ''} ${gitColor}`}>{data.name}</span>
      )}
      {!editing && (
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {dirty && <span className="size-2 rounded-full bg-fg/70" />}
          {kind && (
            <span title={KIND_LABEL[kind]} className={`font-mono text-[11px] ${KIND_COLOR[kind]}`}>
              {KIND_LETTER[kind]}
            </span>
          )}
          {!kind && dirHasChanges && <span className="size-1.5 rounded-full bg-warning/70" />}
        </span>
      )}
    </div>
  )
}
