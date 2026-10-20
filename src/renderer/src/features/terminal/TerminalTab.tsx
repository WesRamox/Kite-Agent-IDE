import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { SquareTerminal } from 'lucide-react'
import { closeTerminal } from './terminal.actions'
import { useT } from '../../lib/i18n'
import { TabCloseButton } from '../../components/TabCloseButton'

export function TerminalTab({ api }: IDockviewPanelHeaderProps) {
  const t = useT()
  return (
    <div
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          closeTerminal(api.id)
        }
      }}
      className="group flex h-full w-full items-center gap-2 px-3"
    >
      <SquareTerminal size={14} className="shrink-0 text-fg-muted" />
      <span className="text-sm">{api.title}</span>
      <TabCloseButton
        label={t('terminal.close')}
        onClick={(e) => {
          e.stopPropagation()
          closeTerminal(api.id)
        }}
      />
    </div>
  )
}
