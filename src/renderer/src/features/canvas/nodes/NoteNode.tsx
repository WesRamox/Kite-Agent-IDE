import type { NodeProps } from '@xyflow/react'
import { StickyNote } from 'lucide-react'
import { copyText } from '../../../lib/clipboard'
import { useT } from '../../../lib/i18n'
import type { FlowNodeOf } from '../canvas'
import { patchNode } from '../canvas.actions'
import { NoteEditor } from './NoteEditor'
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
      <NoteEditor
        value={data.text}
        placeholder={t('canvas.notePlaceholder')}
        onChange={(text) =>
          patchNode(id, (d) =>
            d.kind === 'note' ? { ...d, text: text.slice(0, 20_000) } : d,
          )
        }
      />
    </NodeFrame>
  )
}
