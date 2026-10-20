import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { GitHubMark } from '../../components/GitHubMark'
import { closeGitHubPanel } from './github.actions'
import { useT } from '../../lib/i18n'
import { TabCloseButton } from '../../components/TabCloseButton'

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
      className="group flex h-full w-full max-w-72 items-center gap-2 px-3"
    >
      <GitHubMark size={14} className="shrink-0 text-fg-muted" />
      <span className="truncate text-sm">{api.title}</span>
      <TabCloseButton
        label={t('github.close')}
        onClick={(e) => {
          e.stopPropagation()
          closeGitHubPanel(api.id)
        }}
      />
    </div>
  )
}
