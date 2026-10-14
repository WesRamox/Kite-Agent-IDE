import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { Bot, X } from 'lucide-react'
import { closeTerminal, type TerminalParams } from '../terminal/terminal.actions'
import { displayState, STATE_DOT, STATE_LABEL } from './agent-format'
import { useAgentsStore } from './agents.store'

// Aba do terminal de um agente: mostra o status. Fechar só desconecta; o agente continua.
export function AgentTab({ api, params }: IDockviewPanelHeaderProps<TerminalParams>) {
  const task = useAgentsStore((s) => s.tasks.find((t) => t.id === params.agentTaskId))
  const state = task ? displayState(task) : null
  return (
    <div
      className="group flex h-full items-center gap-1.5 px-3"
      title={state ? STATE_LABEL[state] : undefined}
    >
      <Bot size={14} className="shrink-0 text-fg-muted" />
      <span className="max-w-48 truncate">{api.title}</span>
      {state && <span className={`size-2 rounded-full ${STATE_DOT[state]}`} />}
      <button
        type="button"
        aria-label="Fechar terminal do agente"
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
