import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { FolderSearch } from 'lucide-react'
import { getDockApi } from '../../lib/dock'
import { useT } from '../../lib/i18n'
import { TabCloseButton } from '../../components/TabCloseButton'

export function DiscoverTab({ api }: IDockviewPanelHeaderProps) {
  const t = useT()
  const close = () => {
    const panel = getDockApi()?.getPanel(api.id)
    if (panel) getDockApi()?.removePanel(panel)
  }
  return (
    <div className="group flex h-full w-full items-center gap-2 px-3">
      <FolderSearch size={14} className="shrink-0 text-accent" />
      <span className="max-w-64 truncate text-sm">{api.title}</span>
      <TabCloseButton
        label={t('discover.closeTab')}
        onClick={(e) => {
          e.stopPropagation()
          close()
        }}
      />
    </div>
  )
}
