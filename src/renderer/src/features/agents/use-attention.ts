import { useAgentsStore } from './agents.store'
import { attentionItems, groupItems, type AttentionGroup, type AttentionItem } from './attention'
import { useSessionsStore } from './sessions.store'
import { useNow } from './use-now'

// Grupos da Central (esperando, trabalhando...) para badges e status bar.
export function useAttentionGroups(): Record<AttentionGroup, AttentionItem[]> {
  const sessions = useSessionsStore((s) => s.sessions)
  const tasks = useAgentsStore((s) => s.tasks)
  const now = useNow(true, 30_000)
  return groupItems(attentionItems(sessions, tasks, now))
}
