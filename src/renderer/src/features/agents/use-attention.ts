import type { AgentSession, AgentTask, WorkspaceTasks } from '@shared/types'
import { useMemo } from 'react'
import { linkSessions } from '../tasks/task-links'
import { useTasksStore } from '../tasks/tasks.store'
import { useAgentsStore } from './agents.store'
import { attentionItems, groupItems, type AttentionGroup, type AttentionItem } from './attention'
import { useSessionsStore } from './sessions.store'
import { useNow } from './use-now'

// Itens da Central: agentes do Kite, tarefas do workspace (com as sessões ligadas) e sessões
// soltas.
export function buildItems(
  sessions: AgentSession[],
  tasks: AgentTask[],
  workspace: WorkspaceTasks | null,
  now: number,
): AttentionItem[] {
  const visible = workspace?.imported ? workspace.tasks.filter((t) => !t.hidden) : []
  const links = linkSessions(sessions, visible, workspace?.sessionLinks ?? {})
  return attentionItems(sessions, tasks, now, visible, links)
}

export function useAttentionItems(refreshMs = 30_000): AttentionItem[] {
  const sessions = useSessionsStore((s) => s.sessions)
  const tasks = useAgentsStore((s) => s.tasks)
  const workspace = useTasksStore((s) => s.workspace)
  const now = useNow(true, refreshMs)
  return useMemo(
    () => buildItems(sessions, tasks, workspace, now),
    [sessions, tasks, workspace, now],
  )
}

// Grupos da Central (esperando, trabalhando...) para badges e status bar.
export function useAttentionGroups(): Record<AttentionGroup, AttentionItem[]> {
  const items = useAttentionItems()
  return useMemo(() => groupItems(items), [items])
}
