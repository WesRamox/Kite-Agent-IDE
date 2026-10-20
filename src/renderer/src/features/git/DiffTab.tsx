import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { GitCompare } from 'lucide-react'
import { closeDiff } from './git.actions'
import { useT } from '../../lib/i18n'
import { TabCloseButton } from '../../components/TabCloseButton'

export function DiffTab({ api }: IDockviewPanelHeaderProps) {
  const t = useT()
  return (
    <div
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          closeDiff(api.id)
        }
      }}
      className="group flex h-full w-full items-center gap-2 px-3"
    >
      <GitCompare size={14} className="shrink-0 text-warning" />
      <span className="text-sm">{api.title}</span>
      <TabCloseButton
        label={t('git.closeDiff')}
        onClick={(e) => {
          e.stopPropagation()
          closeDiff(api.id)
        }}
      />
    </div>
  )
}
