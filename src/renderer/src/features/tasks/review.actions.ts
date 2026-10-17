import type { DeliverInput, DeliverResult, Task } from '@shared/types'
import { getDockApi } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { currentItems, resumeHere } from '../agents/attention.actions'
import { focusTerminalByPty } from '../terminal/terminal.actions'
import { openTask, refreshTaskStatus } from './tasks.actions'
import { useTasksStore } from './tasks.store'

export const TASK_REVIEW_COMPONENT = 'task-review'
export const TASK_REVIEW_TAB_COMPONENT = 'task-review-tab'
const PREFIX = 'task-review:'

export function isTaskReviewPanel(id: string): boolean {
  return id.startsWith(PREFIX)
}

export interface TaskReviewParams {
  taskId: string
}

// Abre a revisão da tarefa (canvas, tela 3) no contexto dela.
export async function openTaskReview(taskId: string): Promise<void> {
  if (useTasksStore.getState().activeTaskId !== taskId) await openTask(taskId)
  const dock = getDockApi()
  const task = useTasksStore.getState().workspace?.tasks.find((t) => t.id === taskId)
  if (!dock || !task) return
  const id = `${PREFIX}${taskId}`
  const existing = dock.getPanel(id)
  if (existing) {
    existing.api.setActive()
    return
  }
  const params: TaskReviewParams = { taskId }
  dock.addPanel({
    id,
    component: TASK_REVIEW_COMPONENT,
    tabComponent: TASK_REVIEW_TAB_COMPONENT,
    title: `Revisar · ${task.name}`,
    params,
  })
}

// PR de cada worktree da tarefa (detalhes da tarefa).
export async function loadTaskPRs(taskId: string): Promise<void> {
  const root = useWorkspaceStore.getState().root
  if (!root) return
  const res = await window.api.review.prs(root, taskId)
  if (res.ok) useTasksStore.getState().setPRs(res.data)
}

export async function deliverTask(
  task: Task,
  input: DeliverInput,
): Promise<DeliverResult[] | null> {
  const root = useWorkspaceStore.getState().root
  if (!root) return null
  const results = await attempt(
    window.api.review.deliver(root, task.id, input),
    'Erro ao commitar e abrir os PRs',
  )
  if (!results) return null
  for (const w of input.worktrees) void refreshTaskStatus(w)
  void loadTaskPRs(task.id)
  const failed = results.filter((r) => r.error).length
  if (failed === 0) {
    const prs = results.filter((r) => r.pr).length
    toast.info(
      input.openPRs ? `${prs} ${prs === 1 ? 'PR pronto' : 'PRs prontos'}.` : 'Commits feitos.',
    )
  } else {
    toast.warning(`${failed} ${failed === 1 ? 'repositório falhou' : 'repositórios falharam'}.`)
  }
  return results
}

// Texto colado de uma vez no prompt do agente (bracketed paste) e enviado com Enter.
function pasteAndSend(text: string): string {
  return `\x1b[200~${text}\x1b[201~\r`
}

// "Pedir ajuste ao agente": escreve no terminal da sessão ligada à tarefa (a que espera há mais
// tempo, senão a que trabalha). Sessão fora do Kite: oferece "Retomar aqui".
export async function askAgent(task: Task, text: string): Promise<boolean> {
  const item = currentItems().find((x) => x.wsTask?.id === task.id)
  const sessions = (item?.sessions ?? []).filter((s) => s.status !== 'ended')
  const target =
    sessions.find((s) => s.status === 'waiting' && s.ptyId) ?? sessions.find((s) => s.ptyId) ?? null
  if (target?.ptyId) {
    const res = await window.api.pty.write(target.ptyId, pasteAndSend(text.trim()))
    if (!res.ok) {
      toast.error('O terminal do agente foi fechado.')
      return false
    }
    focusTerminalByPty(target.ptyId)
    toast.info('Pedido enviado ao agente.')
    return true
  }
  if (item && sessions.length > 0) {
    const answer = await window.api.dialog.confirm({
      message: 'O agente desta tarefa roda fora do Kite.',
      detail: 'Para mandar o pedido daqui, retome a sessão num terminal do Kite.',
      buttons: ['Retomar aqui', 'Cancelar'],
      kind: 'info',
    })
    if (answer.ok && answer.data === 0) await resumeHere(item)
    return false
  }
  toast.info('Nenhuma sessão de agente ligada a esta tarefa.')
  return false
}
