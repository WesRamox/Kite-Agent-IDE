import type { NodeProps } from '@xyflow/react'
import { StickyNote } from 'lucide-react'
import { copyText } from '../../../lib/clipboard'
import { useT } from '../../../lib/i18n'
import type { FlowNodeOf } from '../canvas'
import { patchNode } from '../canvas.actions'
import { NodeFrame } from './NodeFrame'

export function NoteNode({ id, data, selected }: NodeProps<FlowNodeOf<'note'>>) {
  const t = useT()
  return (
    <NodeFrame
      id={id}
      data={data}
      selected={selected}
      icon={StickyNote}
      title={t('canvas.note')}
      menu={[{ label: t('canvas.menu.copyText'), onSelect: () => copyText(data.text) }]}
    >
      <textarea
        aria-label={t('canvas.note')}
        value={data.text}
        placeholder={t('canvas.notePlaceholder')}
        onChange={(e) =>
          patchNode(id, (d) =>
            d.kind === 'note' ? { ...d, text: e.target.value.slice(0, 20_000) } : d,
          )
        }
        className="nodrag nowheel h-full w-full resize-none bg-transparent p-3 text-[13px] leading-relaxed text-fg/90 outline-none placeholder:text-fg-muted/60"
      />
    </NodeFrame>
  )
}
