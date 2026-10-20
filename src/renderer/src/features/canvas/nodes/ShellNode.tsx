import type { NodeProps } from '@xyflow/react'
import { Terminal } from 'lucide-react'
import { useState } from 'react'
import type { MenuItem } from '../../../components/ContextMenu'
import { copyText } from '../../../lib/clipboard'
import { useT } from '../../../lib/i18n'
import { basename } from '../../../lib/paths'
import { useAgentsStore } from '../../agents/agents.store'
import { getSession } from '../../terminal/terminal.actions'
import { canvasSessionId, type FlowNodeOf } from '../canvas'
import { startAgentInNode } from '../canvas.actions'
import { CanvasTerminal } from './CanvasTerminal'
import { NodeFrame } from './NodeFrame'

// Terminal comum, sem agente: o shell da pessoa, na pasta da tarefa. Pelo botão direito dá para
// iniciar nele qualquer agente configurado (um subagente, por exemplo).
export function ShellNode({ id, data, selected }: NodeProps<FlowNodeOf<'terminal'>>) {
  const [generation, setGeneration] = useState(0)
  const presets = useAgentsStore((s) => s.presets)
  const t = useT()
  const session = () => getSession(canvasSessionId(id))

  const menu: MenuItem[] = [
    // Agente sem comando configurado (o "customizado" vazio) não tem o que iniciar.
    ...presets
      .filter((p) => p.command.trim())
      .map((p) => ({
        label: t('canvas.menu.startAgent', { name: p.name }),
        onSelect: () => void startAgentInNode(id, p.id),
      })),
    { label: t('canvas.menu.clear'), onSelect: () => session()?.clear() },
    { label: t('canvas.menu.restart'), onSelect: () => setGeneration((g) => g + 1) },
    { label: t('canvas.menu.copyPath'), onSelect: () => copyText(data.cwd) },
  ]

  return (
    <NodeFrame
      id={id}
      data={data}
      selected={selected}
      icon={Terminal}
      title={t('canvas.terminal')}
      menu={menu}
      actions={
        <span
          title={data.cwd}
          className="max-w-48 truncate font-geist-mono text-[11px] text-fg-muted"
        >
          {basename(data.cwd)}
        </span>
      }
    >
      <CanvasTerminal key={generation} nodeId={id} cwd={data.cwd} />
    </NodeFrame>
  )
}
