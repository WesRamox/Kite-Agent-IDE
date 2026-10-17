import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { GitCompare, X } from 'lucide-react'
import { getDockApi } from '../../lib/dock'
import { useT } from '../../lib/i18n'

export function TaskReviewTab({ api }: IDockviewPanelHeaderProps) {
  const t = useT()
  const close = () => {
    const panel = getDockApi()?.getPanel(api.id)
    if (panel) getDockApi()?.removePanel(panel)
  }
  return (
    <div className="group flex h-full items-center gap-1.5 px-3">
      <GitCompare size={14} className="shrink-0 text-warning" />
      <span className="max-w-64 truncate">{api.title}</span>
      <button
        type="button"
        aria-label={t('review.closeTab')}
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
