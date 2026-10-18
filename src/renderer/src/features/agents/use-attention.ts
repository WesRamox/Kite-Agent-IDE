import type { AgentSession, AgentTask, WorkspaceTasks } from '@shared/types'
import { useMemo } from 'react'
import { linkSessions } from '../../lib/task-links'
import { useTasksStore } from '../tasks/tasks.store'
import { useAgentsStore } from './agents.store'
import {
  attentionItems,
  groupItems,
  type AttentionGroup,
  type AttentionItem,
  type ReviewFilter,
} from './attention'
import { useSessionsStore } from './sessions.store'
import { useNow } from './use-now'
import { useLang } from '../../lib/i18n'

// Itens da Central: agentes do Kite, tarefas do workspace (com as sessões ligadas) e sessões
// soltas.
export function buildItems(
  sessions: AgentSession[],
  tasks: AgentTask[],
  workspace: WorkspaceTasks | null,
  now: number,
  review?: ReviewFilter,
): AttentionItem[] {
  const visible = workspace?.imported ? workspace.tasks.filter((t) => !t.hidden) : []
  const links = linkSessions(sessions, visible, workspace?.sessionLinks ?? {})
  return attentionItems(sessions, tasks, now, visible, links, review)
}

export function useAttentionItems(refreshMs = 30_000): AttentionItem[] {
  const sessions = useSessionsStore((s) => s.sessions)
  const tasks = useAgentsStore((s) => s.tasks)
  const workspace = useTasksStore((s) => s.workspace)
  const pending = useSessionsStore((s) => s.pending)
  const dismissed = useSessionsStore((s) => s.dismissed)
  const now = useNow(true, refreshMs)
  // Os rótulos dos itens dependem do idioma: refaz a lista ao trocar.
  const lang = useLang()
  return useMemo(
    () => buildItems(sessions, tasks, workspace, now, { pending, dismissed: new Set(dismissed) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, tasks, workspace, now, lang, pending, dismissed],
  )
}

// Grupos da Central (esperando, trabalhando...) para badges e status bar.
export function useAttentionGroups(): Record<AttentionGroup, AttentionItem[]> {
  const items = useAttentionItems()
  return useMemo(() => groupItems(items), [items])
}
