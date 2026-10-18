import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { Bot, Columns2, Plus, Rows2 } from 'lucide-react'
import { useState } from 'react'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { useAgentsStore } from '../agents/agents.store'
import { startAgentInTask } from '../tasks/tasks.actions'
import { useTasksStore } from '../tasks/tasks.store'
import { openTerminal, splitTerminal } from './terminal.actions'
import { isAgentPanel, isTerminalPanel } from '../../lib/panels'
import { useT } from '../../lib/i18n'

function Action(props: {
  label: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
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

// Botões no cabeçalho de grupos de terminal: novo, dividir à direita, dividir abaixo e, numa
// tarefa aberta, "+ Agente" (canvas, tela 2) com o agente rodando na pasta da tarefa.
export function TerminalGroupActions({ activePanel }: IDockviewHeaderActionsProps) {
  const taskId = useTasksStore((s) => s.activeTaskId)
  const presets = useAgentsStore((s) => s.presets)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const t = useT()
  if (!activePanel || !(isTerminalPanel(activePanel.id) || isAgentPanel(activePanel.id))) {
    return null
  }
  const ref = activePanel.id
  return (
    <div className="flex h-full items-center gap-0.5 px-2">
      {taskId && (
        <Action
          label={t('terminal.newAgentInTask')}
          onClick={(e) =>
            setMenu({
              x: e.clientX,
              y: e.clientY,
              items: presets
                .filter((p) => p.command.trim())
                .map((p) => ({
                  label: p.name,
                  onSelect: () => void startAgentInTask(taskId, p.id),
                })),
            })
          }
        >
          <Bot size={14} />
        </Action>
      )}
      <Action label={t('terminal.new')} onClick={() => openTerminal({ reference: ref })}>
        <Plus size={14} />
      </Action>
      <Action label={t('terminal.splitRight')} onClick={() => splitTerminal(ref, 'right')}>
        <Columns2 size={14} />
      </Action>
      <Action label={t('terminal.splitDown')} onClick={() => splitTerminal(ref, 'below')}>
        <Rows2 size={14} />
      </Action>
      {menu && menu.items.length > 0 && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
