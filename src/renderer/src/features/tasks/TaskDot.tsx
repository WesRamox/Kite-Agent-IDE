import type { AttentionGroup } from '../agents/attention'
import { useAttentionItems } from '../agents/use-attention'

const DOT: Record<AttentionGroup, string> = {
  waiting: 'bg-accent',
  running: 'bg-info',
  review: 'bg-success',
  idle: 'bg-fg-muted/50',
}

// Bolinha com o estado da tarefa na Central (esperando, trabalhando...).
export function TaskDot({ taskId }: { taskId: string }) {
  const item = useAttentionItems().find((x) => x.wsTask?.id === taskId)
  return <span className={`size-2 shrink-0 rounded-full ${DOT[item?.group ?? 'idle']}`} />
}
