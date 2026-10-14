import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { GitCompare, X } from 'lucide-react'
import { closeDiff } from './git.actions'

export function DiffTab({ api }: IDockviewPanelHeaderProps) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          closeDiff(api.id)
        }
      }}
      className="group flex h-full items-center gap-1.5 px-3"
    >
      <GitCompare size={14} className="shrink-0 text-warning" />
      <span>{api.title}</span>
      <button
        type="button"
        aria-label="Fechar diff"
        onClick={(e) => {
          e.stopPropagation()
          closeDiff(api.id)
        }}
        className="flex size-4 items-center justify-center rounded hover:bg-surface-3"
      >
        <X size={12} />
      </button>
    </div>
  )
}
