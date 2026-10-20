import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { Bot } from 'lucide-react'
import { closeTerminal, type TerminalParams } from '../terminal/terminal.actions'
import { displayState, STATE_DOT, stateLabel } from './agent-format'
import { useAgentsStore } from './agents.store'
import { useT } from '../../lib/i18n'
import { TabCloseButton } from '../../components/TabCloseButton'

// Aba do terminal de um agente: mostra o status. Fechar só desconecta; o agente continua.
export function AgentTab({ api, params }: IDockviewPanelHeaderProps<TerminalParams>) {
  const task = useAgentsStore((s) => s.tasks.find((t) => t.id === params.agentTaskId))
  const state = task ? displayState(task) : null
  const t = useT()
  return (
    <div
      className="group flex h-full w-full items-center gap-2 px-3"
      title={state ? stateLabel(state) : undefined}
    >
      <Bot size={14} className="shrink-0 text-fg-muted" />
      <span className="max-w-48 truncate text-sm">{api.title}</span>
      {state && <span className={`size-2 rounded-full ${STATE_DOT[state]}`} />}
      <TabCloseButton
        label={t('agentTab.close')}
        onClick={(e) => {
          e.stopPropagation()
          closeTerminal(api.id)
        }}
      />
    </div>
  )
}
