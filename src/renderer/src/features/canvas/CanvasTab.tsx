import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { Workflow, X } from 'lucide-react'
import { getDockApi } from '../../lib/dock'
import { useT } from '../../lib/i18n'

export function CanvasTab({ api }: IDockviewPanelHeaderProps) {
  const t = useT()
  const close = () => {
    const panel = getDockApi()?.getPanel(api.id)
    if (panel) getDockApi()?.removePanel(panel)
  }
  return (
    <div className="group flex h-full items-center gap-1.5 px-3">
      <Workflow size={14} className="shrink-0 text-accent" />
      <span className="max-w-64 truncate">{api.title}</span>
      <button
        type="button"
        aria-label={t('canvas.closeTab')}
        onClick={(e) => {
          e.stopPropagation()
          close()
        }}
        className="flex size-4 items-center justify-center rounded hover:bg-surface-3"
      >
        <X size={12} />
      </button>
    </div>
  )
}
