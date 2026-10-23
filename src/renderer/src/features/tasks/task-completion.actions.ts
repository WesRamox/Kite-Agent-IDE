import type { RemoveWorktreesResult, Task } from '@shared/types'
import { getDock } from '../../lib/dock'
import { t } from '../../lib/i18n'
import { attempt } from '../../lib/ipc'
import { useContextStore } from '../../stores/context.store'
import { toast } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { stopAgent } from '../agents/agents.actions'
import { useAgentsStore } from '../agents/agents.store'
import { refreshGit } from '../git/git-sync.actions'
import { applyWorkspace, showWorkspace } from './tasks.actions'
import { taskContext, useTasksStore } from './tasks.store'

const root = () => useWorkspaceStore.getState().root
const findTask = (id: string) => useTasksStore.getState().workspace?.tasks.find((x) => x.id === id)

// Concluída sai da Central e do Ctrl+K; desmarcar a traz de volta para o grupo de antes.
export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const dir = root()
  if (!dir) return
  const ws = await attempt(window.api.task.setDone(dir, id, done), t('tasks.doneError'))
  if (!ws) return
  await applyWorkspace(ws)
  const task = ws.tasks.find((x) => x.id === id)
  if (done && task) {
    toast.action(t('tasks.markedDone', { name: task.name }), {
      label: t('tasks.removeWorktreesNow'),
      run: () => void removeTaskWorktrees(id),
    })
  }
}

// Exclui as worktrees de uma tarefa concluída (as branches ficam). Pede confirmação e, se houver
// alterações não commitadas, uma segunda antes de forçar, como no painel Git.
export async function removeTaskWorktrees(id: string): Promise<void> {
  const dir = root()
  const task = findTask(id)
  if (!dir || !task) return
  const agents = useAgentsStore.getState().tasks.filter((a) => a.wsTaskId === id && a.alive)
  const answer = await window.api.dialog.confirm({
    message: t('tasks.removeWorktreesConfirm', { name: task.name, n: task.worktrees.length }),
    detail: removeDetail(task, agents.length),
    buttons: [t('tasks.removeWorktrees'), t('common.cancel')],
    kind: 'warning',
  })
  if (!answer.ok || answer.data !== 0) return
  // Um processo com a pasta aberta impede apagá-la (no Windows, sempre).
  for (const a of agents) await stopAgent(a.id)
  await closeTaskContext(task)
  let res: RemoveWorktreesResult | null = await attempt(
    window.api.task.removeWorktrees(dir, id, false),
    t('tasks.removeWorktreesError'),
  )
  if (res?.kind === 'dirty') {
    const again = await window.api.dialog.confirm({
      message: t('tasks.dirtyWorktrees', { repos: res.repos.join(', ') }),
      detail: t('tasks.dirtyDetail'),
      buttons: [t('tasks.removeAnyway'), t('common.cancel')],
      kind: 'warning',
    })
    if (!again.ok || again.data !== 0) return
    res = await attempt(
      window.api.task.removeWorktrees(dir, id, true),
      t('tasks.removeWorktreesError'),
    )
  }
  if (res?.kind !== 'removed') return
  await applyWorkspace(res.workspace)
  void refreshGit()
  const failed = res.worktrees.filter((w) => w.error !== null)
  const n = res.worktrees.length - failed.length
  if (failed.length > 0) {
    toast.error(
      t('tasks.worktreesPartial', {
        repos: failed.map((w) => `${w.repoName} (${w.error ?? ''})`).join('; '),
      }),
    )
  } else if (res.folderTrashed) toast.info(t('tasks.worktreesRemovedFolder', { n }))
  else toast.info(t('tasks.worktreesRemoved', { n }))
}

function removeDetail(task: Task, agents: number): string {
  const lines = [
    t('tasks.removeWorktreesDetail', { paths: task.worktrees.map((w) => w.path).join('\n') }),
  ]
  if (task.folder) lines.push(t('tasks.removeWorktreesFolder', { folder: task.folder }))
  if (agents > 0) lines.push(t('tasks.removeWorktreesAgents', { n: agents }))
  return lines.join('\n\n')
}

// Fecha abas e terminais da tarefa (o terminal é encerrado junto com a aba) e solta os
// watchers das worktrees, que no Windows também seguram a pasta.
async function closeTaskContext(task: Task): Promise<void> {
  const context = taskContext(task.id)
  const dock = getDock(context)
  if (dock) for (const panel of [...dock.panels]) dock.removePanel(panel)
  if (useTasksStore.getState().activeTaskId === task.id) showWorkspace()
  useContextStore.getState().close(context)
  // Falha ao soltar um watcher não impede a exclusão: o main tenta remover de novo e, no pior
  // caso, mostra o erro do git por repo.
  await Promise.all(
    task.worktrees.flatMap((w) => [window.api.fs.unwatch(w.path), window.api.git.unwatch(w.path)]),
  )
}
