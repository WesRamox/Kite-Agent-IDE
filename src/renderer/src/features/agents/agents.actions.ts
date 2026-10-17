import type { AgentPreset, StartAgentInput } from '@shared/types'
import { useEffect } from 'react'
import { activeContext, contextOfPanel, getDockApi } from '../../lib/dock'
import { useContextStore } from '../../stores/context.store'
import { useTasksStore } from '../tasks/tasks.store'
import { attempt } from '../../lib/ipc'
import { useLayoutStore } from '../../stores/layout.store'
import { toast } from '../../stores/toast.store'
import { refreshGit } from '../git/git-sync'
import { closeTerminal, type TerminalParams } from '../terminal/terminal.actions'
import { agentPanelId, isAgentPanel, isTerminalPanel } from '../terminal/terminals'
import { useAgentsStore } from './agents.store'
import { useAttentionStore } from './attention.store'
import { closeModal } from '../../stores/modal.store'
import { t } from '../../lib/i18n'

export const REVIEW_COMPONENT = 'agent-review'
export const AGENT_TAB_COMPONENT = 'agent-terminal'
export const REVIEW_TAB_COMPONENT = 'agent-review-tab'
const REVIEW_PREFIX = 'agent-review:'

export function isReviewPanel(id: string): boolean {
  return id.startsWith(REVIEW_PREFIX)
}

const store = () => useAgentsStore.getState()

export async function loadAgents(): Promise<void> {
  const [tasks, presets] = await Promise.all([window.api.agent.list(), window.api.agent.presets()])
  store().set({
    ...(tasks.ok ? { tasks: tasks.data } : {}),
    ...(presets.ok ? { presets: presets.data } : {}),
  })
}

// Mantém a lista em dia com os eventos do main e reage ao clique nas notificações.
export function useAgentsSync(): void {
  useEffect(() => {
    void loadAgents()
    const offStatus = window.api.agent.onStatus((task) => store().upsert(task))
    const offFocus = window.api.agent.onFocus(({ id }) => {
      store().set({ focused: id })
      useAttentionStore.getState().set({ highlighted: `task:${id}` })
      const layout = useLayoutStore.getState()
      if (layout.activeView !== 'attention' || !layout.sidebarVisible)
        layout.selectView('attention')
      openAgentTerminal(id)
    })
    return () => {
      offStatus()
      offFocus()
    }
  }, [])
}

export async function startAgent(input: StartAgentInput): Promise<boolean> {
  const task = await attempt(window.api.agent.start(input), t('agents.startError'))
  if (!task) return false
  store().upsert(task)
  store().set({ focused: task.id })
  openAgentTerminal(task.id)
  void refreshGit() // nova worktree/branch
  return true
}

// Abre (ou foca) o terminal do agente, no grupo dos terminais.
export function openAgentTerminal(taskId: string): void {
  closeModal()
  const dock = getDockApi()
  const task = store().tasks.find((t) => t.id === taskId)
  if (!dock || !task) return
  const id = agentPanelId(taskId)
  // O terminal do agente é um só: se ele já está aberto em outra tarefa, vai até ela.
  const where = contextOfPanel(id)
  if (where && where !== activeContext()) {
    useContextStore.getState().activate(where)
    useTasksStore
      .getState()
      .set({ activeTaskId: where.startsWith('task:') ? where.slice(5) : null })
    getDockApi()?.getPanel(id)?.api.setActive()
    return
  }
  const existing = dock.getPanel(id)
  if (existing) {
    existing.api.setActive()
    return
  }
  const params: TerminalParams = { agentTaskId: taskId }
  const base = {
    id,
    component: 'terminal',
    tabComponent: AGENT_TAB_COMPONENT,
    title: task.name,
    params,
  }
  const reference = dock.panels.find((p) => isAgentPanel(p.id) || isTerminalPanel(p.id))
  if (reference)
    dock.addPanel({ ...base, position: { referencePanel: reference.id, direction: 'within' } })
  else if (dock.panels.length > 0)
    dock.addPanel({ ...base, position: { direction: 'below' }, initialHeight: 320 })
  else dock.addPanel(base)
}

export function stopAgent(taskId: string) {
  return attempt(window.api.agent.stop(taskId), t('agents.stopError'))
}

export async function restartAgent(taskId: string): Promise<void> {
  const task = await attempt(window.api.agent.restart(taskId), t('agents.restartError'))
  if (!task) return
  store().upsert(task)
  // O terminal antigo assistia o processo anterior: reabre conectado ao novo.
  closeTerminal(agentPanelId(taskId))
  openAgentTerminal(taskId)
}

export async function removeAgent(taskId: string): Promise<void> {
  const task = store().tasks.find((t) => t.id === taskId)
  if (!task) return
  const answer = await window.api.dialog.confirm({
    message: t('agents.removeConfirm', { name: task.name }),
    detail: t('agents.removeDetail', { worktree: task.worktreePath, branch: task.branch }),
    buttons: [t('agents.removeWithWorktree'), t('agents.removeFromList'), t('common.cancel')],
    kind: 'warning',
  })
  if (!answer.ok || answer.data === 2) return
  const ok = await attempt(
    window.api.agent.remove(taskId, answer.data === 0),
    t('agents.removeError'),
  )
  if (ok === null) return
  closeTerminal(agentPanelId(taskId))
  const review = getDockApi()?.getPanel(`${REVIEW_PREFIX}${taskId}`)
  if (review) getDockApi()?.removePanel(review)
  void refreshGit()
}

export function openReview(taskId: string): void {
  closeModal()
  const dock = getDockApi()
  const task = store().tasks.find((t) => t.id === taskId)
  if (!dock || !task) return
  const id = `${REVIEW_PREFIX}${taskId}`
  const existing = dock.getPanel(id)
  if (existing) {
    existing.api.setActive()
    return
  }
  dock.addPanel({
    id,
    component: REVIEW_COMPONENT,
    tabComponent: REVIEW_TAB_COMPONENT,
    title: t('agentReview.tabTitle', { name: task.name }),
    params: { taskId },
  })
}

export async function savePresets(presets: AgentPreset[]): Promise<boolean> {
  const saved = await attempt(window.api.agent.savePresets(presets), t('presets.saveError'))
  if (!saved) return false
  store().set({ presets: saved })
  toast.info(t('presets.saved'))
  return true
}
