import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { Columns2, Plus, Rows2 } from 'lucide-react'
import { openTerminal, splitTerminal } from './terminal.actions'
import { isTerminalPanel } from './terminals'

function Action(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg"
    >
      {props.children}
    </button>
  )
}

// Botões no cabeçalho de grupos de terminal: novo, dividir à direita, dividir abaixo.
export function TerminalGroupActions({ activePanel }: IDockviewHeaderActionsProps) {
  if (!activePanel || !isTerminalPanel(activePanel.id)) return null
  const ref = activePanel.id
  return (
    <div className="flex h-full items-center gap-0.5 px-2">
      <Action label="Novo terminal" onClick={() => openTerminal({ reference: ref })}>
        <Plus size={14} />
      </Action>
      <Action label="Dividir à direita" onClick={() => splitTerminal(ref, 'right')}>
        <Columns2 size={14} />
      </Action>
      <Action label="Dividir abaixo" onClick={() => splitTerminal(ref, 'below')}>
        <Rows2 size={14} />
      </Action>
    </div>
  )
}
