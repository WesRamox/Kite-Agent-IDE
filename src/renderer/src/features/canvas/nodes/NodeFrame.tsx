import { Handle, NodeResizer, Position } from '@xyflow/react'
import type { CanvasNodeColor, CanvasNodeData } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ContextMenu, type MenuItem } from '../../../components/ContextMenu'
import { useT } from '../../../lib/i18n'
import { MIN_SIZE } from '../canvas'
import {
  disconnectNode,
  duplicateNode,
  removeNode,
  setNodeColor,
  setNodeLabel,
} from '../canvas.actions'

// Cor escolhida pela pessoa (tokens do tema): borda, cabeçalho, fundo, ícone e ponto.
const COLORS: Record<
  CanvasNodeColor,
  { border: string; header: string; bg: string; icon: string; dot: string }
> = {
  accent: {
    border: 'border-accent/60',
    header: 'bg-accent/25',
    bg: 'bg-accent/8',
    icon: 'text-accent',
    dot: 'bg-accent',
  },
  info: {
    border: 'border-info/60',
    header: 'bg-info/25',
    bg: 'bg-info/8',
    icon: 'text-info',
    dot: 'bg-info',
  },
  success: {
    border: 'border-success/60',
    header: 'bg-success/25',
    bg: 'bg-success/8',
    icon: 'text-success',
    dot: 'bg-success',
  },
  warning: {
    border: 'border-warning/60',
    header: 'bg-warning/25',
    bg: 'bg-warning/8',
    icon: 'text-warning',
    dot: 'bg-warning',
  },
  danger: {
    border: 'border-danger/60',
    header: 'bg-danger/25',
    bg: 'bg-danger/8',
    icon: 'text-danger',
    dot: 'bg-danger',
  },
  merged: {
    border: 'border-merged/60',
    header: 'bg-merged/25',
    bg: 'bg-merged/8',
    icon: 'text-merged',
    dot: 'bg-merged',
  },
}
const COLOR_ORDER: CanvasNodeColor[] = ['accent', 'info', 'success', 'warning', 'danger', 'merged']

interface Props {
  id: string
  data: CanvasNodeData
  selected: boolean
  icon: LucideIcon
  // Nome padrão do tipo; o nome dado pela pessoa (duplo clique) vence.
  title: string
  // Ao lado do título: status, endereço, botões.
  actions?: ReactNode
  // Itens do botão direito próprios do tipo; os comuns (renomear, duplicar, desligar, remover)
  // vêm depois, e as cores ficam no topo.
  menu?: MenuItem[]
  children: ReactNode
}

// Moldura comum dos blocos: entrada à esquerda, saída à direita (como no n8n), cabeçalho que
// arrasta (duplo clique no nome renomeia), cantos para redimensionar quando selecionado e menu
// no botão direito.
export function NodeFrame({
  id,
  data,
  selected,
  icon: Icon,
  title,
  actions,
  menu = [],
  children,
}: Props) {
  const t = useT()
  const min = MIN_SIZE[data.kind]
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const name = data.label ?? title
  const color = data.color ? COLORS[data.color] : null

  const items: MenuItem[] = [
    ...menu,
    { label: t('canvas.menu.rename'), onSelect: () => setRenaming(true) },
    { label: t('canvas.menu.duplicate'), onSelect: () => duplicateNode(id) },
    { label: t('canvas.menu.disconnect'), onSelect: () => disconnectNode(id) },
    { label: t('canvas.remove'), onSelect: () => removeNode(id), danger: true },
  ]
  const swatches = (
    <div className="flex items-center gap-1.5 border-b border-border px-3 pt-1.5 pb-2.5">
      <span className="mr-1 text-[11px] text-fg-muted">{t('canvas.menu.color')}</span>
      <button
        type="button"
        aria-label={t('canvas.color.none')}
        title={t('canvas.color.none')}
        onClick={() => {
          setNodeColor(id, null)
          setAt(null)
        }}
        className={`size-4 rounded-full border border-dashed border-fg-muted/60 ${data.color ? '' : 'ring-2 ring-fg/60 ring-offset-1 ring-offset-surface-2'}`}
      />
      {COLOR_ORDER.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={t(`canvas.color.${c}`)}
          title={t(`canvas.color.${c}`)}
          onClick={() => {
            setNodeColor(id, c)
            setAt(null)
          }}
          className={`size-4 rounded-full transition-transform hover:scale-125 ${COLORS[c].dot} ${
            data.color === c ? 'ring-2 ring-fg/60 ring-offset-1 ring-offset-surface-2' : ''
          }`}
        />
      ))}
    </div>
  )

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setAt({ x: e.clientX, y: e.clientY })
      }}
      className={`kite-node flex h-full w-full flex-col rounded-[10px] border font-geist text-fg ${
        color?.bg ?? 'bg-surface-1'
      } ${
        selected ? 'kite-node--selected border-accent' : (color?.border ?? 'border-border')
      }`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={min.width}
        minHeight={min.height}
        lineClassName="kite-resize-line"
        handleClassName="kite-resize-handle"
      />
      <Handle type="target" position={Position.Top} className="kite-handle kite-handle--in" />
      <Handle type="target" position={Position.Bottom} className="kite-handle kite-handle--in" />
      <Handle type="target" position={Position.Left} className="kite-handle kite-handle--in" />
      <Handle type="source" position={Position.Top} className="kite-handle kite-handle--out" />
      <Handle type="source" position={Position.Bottom} className="kite-handle kite-handle--out" />
      <Handle type="source" position={Position.Right} className="kite-handle kite-handle--out" />
      <header
        className={`flex h-9 shrink-0 cursor-grab items-center gap-2 rounded-t-[10px] border-b border-border px-2.5 active:cursor-grabbing ${
          color?.header ?? 'bg-surface-2/70'
        }`}
      >
        <Icon
          size={14}
          strokeWidth={1.8}
          className={`shrink-0 ${color?.icon ?? 'text-fg-muted'}`}
        />
        {renaming ? (
          <NameInput
            initial={name}
            onDone={(value) => {
              // Voltar ao nome do tipo é o mesmo que não ter nome próprio.
              if (value !== null) setNodeLabel(id, value.trim() === title ? '' : value)
              setRenaming(false)
            }}
          />
        ) : (
          <span
            title={t('canvas.renameHint')}
            onDoubleClick={() => setRenaming(true)}
            className="min-w-0 flex-1 truncate text-xs font-medium"
          >
            {name}
          </span>
        )}
        {actions}
        <button
          type="button"
          aria-label={t('canvas.removeNode', { name })}
          title={t('canvas.remove')}
          onClick={() => removeNode(id)}
          className="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <X size={13} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden rounded-b-[10px]">{children}</div>
      {at && (
        <ContextMenu
          x={at.x}
          y={at.y}
          items={items}
          header={swatches}
          onClose={() => setAt(null)}
        />
      )}
    </div>
  )
}

// Nome do bloco: Enter ou sair do campo confirma (vazio volta ao nome do tipo); Esc desiste.
function NameInput({
  initial,
  onDone,
}: {
  initial: string
  onDone: (name: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  const t = useT()
  return (
    <input
      autoFocus
      aria-label={t('canvas.nodeName')}
      value={value}
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value)
        if (e.key === 'Escape') onDone(null)
      }}
      className="nodrag h-6 min-w-0 flex-1 rounded-md border border-accent bg-surface-0 px-1.5 text-xs text-fg outline-none"
    />
  )
}
