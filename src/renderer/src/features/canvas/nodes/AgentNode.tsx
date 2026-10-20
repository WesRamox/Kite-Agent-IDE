import type { NodeProps } from '@xyflow/react'
import { SquareTerminal } from 'lucide-react'
import { useT } from '../../../lib/i18n'
import { openAgentTerminal } from '../../agents/agents.actions'
import { useAgentsStore } from '../../agents/agents.store'
import { openTask } from '../../tasks/tasks.actions'
import type { FlowNodeOf } from '../canvas'
import { NodeFrame } from './NodeFrame'
import { CanvasTerminal } from './CanvasTerminal'

const DOT = { running: 'bg-info', waiting: 'bg-accent', done: 'bg-fg-muted/50', error: 'bg-danger' }

export function AgentNode({ id, data, selected }: NodeProps<FlowNodeOf<'agent'>>) {
  const agent = useAgentsStore((s) => s.tasks.find((a) => a.id === data.agentId))
  const t = useT()
  return (
    <NodeFrame
      id={id}
      data={data}
      selected={selected}
      icon={SquareTerminal}
      title={agent?.name ?? t('canvas.agentGone')}
      menu={
        agent
          ? [
              { label: t('canvas.menu.openTab'), onSelect: () => openAgentTerminal(agent.id) },
              ...(agent.wsTaskId
                ? [
                    {
                      label: t('canvas.menu.openTask'),
                      onSelect: () => void openTask(agent.wsTaskId ?? ''),
                    },
                  ]
                : []),
            ]
          : []
      }
      actions={
        agent && (
          <span className="flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span className={`size-[7px] rounded-full ${DOT[agent.status]}`} />
            {t(`canvas.agentStatus.${agent.status}`)}
          </span>
        )
      }
    >
      {agent ? (
        <CanvasTerminal nodeId={id} agentId={agent.id} />
      ) : (
        <p className="p-3 text-xs text-fg-muted">{t('canvas.agentGoneHint')}</p>
      )}
    </NodeFrame>
  )
}
