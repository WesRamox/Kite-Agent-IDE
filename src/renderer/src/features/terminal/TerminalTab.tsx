import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { SquareTerminal, X } from 'lucide-react'
import { closeTerminal } from './terminal.actions'
import { useT } from '../../lib/i18n'

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
      className="group flex h-full items-center gap-1.5 px-3"
    >
      <SquareTerminal size={14} className="shrink-0 text-fg-muted" />
      <span>{api.title}</span>
      <button
        type="button"
        aria-label={t('terminal.close')}
        onClick={(e) => {
          e.stopPropagation()
          closeTerminal(api.id)
        }}
        className="flex size-4 items-center justify-center rounded hover:bg-surface-3"
      >
        <X size={12} />
      </button>
    </div>
  )
}
