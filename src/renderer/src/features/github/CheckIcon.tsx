import type { ChecksState } from '@shared/types'
import { CircleCheck, CircleDashed, CircleX, Clock } from 'lucide-react'
import { useT } from '../../lib/i18n'

const ICONS: Record<ChecksState, [typeof CircleCheck, string]> = {
  success: [CircleCheck, 'text-success'],
  failure: [CircleX, 'text-danger'],
  pending: [Clock, 'text-warning'],
  none: [CircleDashed, 'text-fg-muted'],
}

export function CheckIcon({ state, size = 14 }: { state: ChecksState; size?: number }) {
  const [Icon, color] = ICONS[state]
  const t = useT()
  return (
    <Icon size={size} className={`shrink-0 ${color}`} aria-label={t(`github.checks.${state}`)} />
  )
}
