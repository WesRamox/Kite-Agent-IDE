import type { ChecksState } from '@shared/types'
import { CircleCheck, CircleDashed, CircleX, Clock } from 'lucide-react'

const ICONS: Record<ChecksState, [typeof CircleCheck, string, string]> = {
  success: [CircleCheck, 'text-success', 'Checks passaram'],
  failure: [CircleX, 'text-danger', 'Checks falharam'],
  pending: [Clock, 'text-warning', 'Checks em andamento'],
  none: [CircleDashed, 'text-fg-muted', 'Sem checks'],
}

export function CheckIcon({ state, size = 14 }: { state: ChecksState; size?: number }) {
  const [Icon, color, label] = ICONS[state]
  return <Icon size={size} className={`shrink-0 ${color}`} aria-label={label} />
}
