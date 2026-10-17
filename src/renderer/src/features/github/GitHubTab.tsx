import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { X } from 'lucide-react'
import { GitHubMark } from '../../components/GitHubMark'
import { closeGitHubPanel } from './github.actions'
import { useT } from '../../lib/i18n'

export function GitHubTab({ api }: IDockviewPanelHeaderProps) {
  const t = useT()
  return (
    <div
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          closeGitHubPanel(api.id)
        }
      }}
      className="group flex h-full max-w-72 items-center gap-1.5 px-3"
    >
      <GitHubMark size={14} className="shrink-0 text-fg-muted" />
      <span className="truncate">{api.title}</span>
      <button
        type="button"
        aria-label={t('github.close')}
        onClick={(e) => {
          e.stopPropagation()
          closeGitHubPanel(api.id)
        }}
        className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-surface-3"
      >
        <X size={12} />
      </button>
    </div>
  )
}
