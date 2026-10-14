import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { X } from 'lucide-react'
import { FileIcon } from '../explorer/FileIcon'
import { closeFile } from './editor.actions'
import { useEditorStore } from './editor.store'

export function EditorTab({ api, params }: IDockviewPanelHeaderProps<{ path: string }>) {
  const path = params.path
  const dirty = useEditorStore((s) => s.tabs[path]?.dirty ?? false)

  return (
    <div
      title={path}
      onMouseDown={(e) => {
        // Botão do meio fecha a aba.
        if (e.button === 1) {
          e.preventDefault()
          void closeFile(path)
        }
      }}
      className="group flex h-full items-center gap-1.5 px-3"
    >
      <FileIcon name={api.title ?? ''} kind="file" />
      <span className={dirty ? 'italic' : ''}>{api.title}</span>
      <button
        type="button"
        aria-label={dirty ? 'Não salvo. Fechar' : 'Fechar'}
        onClick={(e) => {
          e.stopPropagation()
          void closeFile(path)
        }}
        className="relative flex size-4 items-center justify-center rounded hover:bg-surface-3"
      >
        {dirty && <span className="size-2 rounded-full bg-fg/80 group-hover:hidden" />}
        <X size={12} className={dirty ? 'hidden group-hover:block' : ''} />
      </button>
    </div>
  )
}
