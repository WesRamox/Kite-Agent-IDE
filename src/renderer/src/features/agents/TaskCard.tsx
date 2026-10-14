import type { AgentTask } from '@shared/types'
import { GitCompare, RotateCcw, Square, SquareTerminal, Trash2 } from 'lucide-react'
import { basename } from '../../lib/paths'
import { displayState, formatDuration, STATE_DOT, STATE_LABEL } from './agent-format'
import {
  openAgentTerminal,
  openReview,
  removeAgent,
  restartAgent,
  stopAgent,
} from './agents.actions'
import { useAgentsStore } from './agents.store'
import { useNow } from './use-now'

function Action(props: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      className={`rounded p-1 text-fg-muted hover:bg-surface-3 ${props.danger ? 'hover:text-red-300' : 'hover:text-fg'}`}
    >
      {props.children}
    </button>
  )
}

export function TaskCard({ task }: { task: AgentTask }) {
  const focused = useAgentsStore((s) => s.focused === task.id)
  const now = useNow(task.alive)
  const state = displayState(task)
  const elapsed = (task.endedAt ?? now) - task.startedAt

  return (
    <li
      aria-label={`Tarefa ${task.name}`}
      className={`border-b border-border px-3 py-2 ${focused ? 'bg-accent/10' : ''}`}
      onClick={() => useAgentsStore.getState().set({ focused: task.id })}
    >
      <div className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${STATE_DOT[state]}`} />
        <span className="min-w-0 flex-1 truncate text-fg">{task.name}</span>
        <span className="font-mono text-[11px] text-fg-muted" aria-label="Tempo rodando">
          {formatDuration(elapsed)}
        </span>
      </div>
      <p className="mt-0.5 truncate pl-4 text-[11px]" aria-label="Status">
        <span
          className={
            state === 'waiting'
              ? 'text-amber-300'
              : state === 'error'
                ? 'text-red-300'
                : 'text-fg-muted'
          }
        >
          {STATE_LABEL[state]}
          {state === 'error' && task.exitCode !== null ? ` (código ${task.exitCode})` : ''}
        </span>
        <span className="text-fg-muted"> · {task.presetName}</span>
      </p>
      <p className="truncate pl-4 text-[11px] text-fg-muted" title={task.worktreePath}>
        {task.branch} · {basename(task.worktreePath)}
      </p>
      <div className="mt-1 flex items-center gap-0.5 pl-3">
        <Action label="Terminal do agente" onClick={() => openAgentTerminal(task.id)}>
          <SquareTerminal size={14} />
        </Action>
        <Action label="Revisar alterações" onClick={() => openReview(task.id)}>
          <GitCompare size={14} />
        </Action>
        {task.alive ? (
          <Action label="Parar agente" onClick={() => void stopAgent(task.id)}>
            <Square size={14} />
          </Action>
        ) : (
          <Action label="Reiniciar agente" onClick={() => void restartAgent(task.id)}>
            <RotateCcw size={14} />
          </Action>
        )}
        <span className="flex-1" />
        <Action label="Remover tarefa" danger onClick={() => void removeAgent(task.id)}>
          <Trash2 size={14} />
        </Action>
      </div>
    </li>
  )
}
