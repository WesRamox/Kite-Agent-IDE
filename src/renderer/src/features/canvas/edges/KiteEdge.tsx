import {
  EdgeLabelRenderer,
  getBezierPath,
  type ConnectionLineComponentProps,
  type EdgeProps,
} from '@xyflow/react'
import { Trash } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../../lib/i18n'
import { useAgentsStore } from '../../agents/agents.store'
import { removeEdge } from '../canvas.actions'
import { useCanvasStore } from '../canvas.store'

// Curva com saída e chegada na horizontal, como no n8n.
const CURVATURE = 0.4

// Ligação entre blocos: linha discreta; em destaque ao passar o mouse ou selecionar, com o botão
// de remover no meio. Corre um fluxo pela linha enquanto o agente de origem está trabalhando.
export function KiteEdge(props: EdgeProps) {
  const { id, source, selected } = props
  const [path, labelX, labelY] = getBezierPath({ ...props, curvature: CURVATURE })
  const agentId = useCanvasStore((s) => {
    const node = s.nodes.find((n) => n.id === source)
    return node?.data.kind === 'agent' ? node.data.agentId : null
  })
  const running = useAgentsStore(
    (s) => agentId !== null && s.tasks.some((a) => a.id === agentId && a.status === 'running'),
  )
  const [hover, setHover] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const t = useT()

  // Sair da linha para o botão não pode esconder o botão: a saída espera um pouco.
  const enter = () => {
    clearTimeout(timer.current)
    setHover(true)
  }
  const leave = () => {
    timer.current = setTimeout(() => setHover(false), 160)
  }
  const active = hover || Boolean(selected)

  return (
    <>
      <path d={path} className="kite-edge-hit" onMouseEnter={enter} onMouseLeave={leave} />
      <path d={path} className={`kite-edge ${active ? 'kite-edge--active' : ''}`} />
      {(running || active) && <path d={path} className="kite-edge-flow" />}
      {active && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label={t('canvas.removeLink')}
            title={t('canvas.removeLink')}
            onMouseEnter={enter}
            onMouseLeave={leave}
            onClick={() => removeEdge(id)}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="kite-edge-button nodrag nopan pointer-events-auto absolute flex size-7 items-center justify-center rounded-full border border-border bg-surface-2 text-fg-muted shadow-lg hover:border-danger hover:text-danger"
          >
            <Trash size={13} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// A linha enquanto a pessoa arrasta de uma saída: tracejada e correndo, até soltar numa entrada.
export function KiteConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    curvature: CURVATURE,
  })
  return (
    <g>
      <path d={path} className="kite-edge-drag" />
      <circle cx={toX} cy={toY} r={4.5} className="kite-edge-drag-end" />
    </g>
  )
}
