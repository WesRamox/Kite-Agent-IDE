import type { TaskGrouping, WorkspaceTasks } from '@shared/types'
import { useEffect } from 'react'
import { getDockApi, WORKSPACE_CONTEXT } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { useContextStore } from '../../stores/context.store'
import { useLayoutStore } from '../../stores/layout.store'
import { toast } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useExplorerStore } from '../explorer/explorer.store'
import { useQuickOpenStore } from '../quick-open/quick-open.store'
import { taskContext, useTasksStore } from './tasks.store'

export const DISCOVER_COMPONENT = 'discover'
export const DISCOVER_TAB_COMPONENT = 'discover-tab'
const DISCOVER_PANEL_ID = 'discover'

export function isDiscoverPanel(id: string): boolean {
  return id === DISCOVER_PANEL_ID
}

const store = () => useTasksStore.getState()
const root = () => useWorkspaceStore.getState().root

// Descobre as tarefas da pasta aberta e passa a observar as worktrees. Na primeira vez num
// workspace com worktrees, abre a tela de descoberta (canvas, tela 4).
export async function loadTasks(dir: string, opts: { fromOpen?: boolean } = {}): Promise<void> {
  const ws = await attempt(window.api.task.discover(dir), 'Erro ao procurar tarefas')
  if (!ws || root() !== dir) return
  await applyWorkspace(ws)
  await attempt(window.api.task.watch(dir), 'Erro ao observar as worktrees')
  if (opts.fromOpen && !ws.imported && (ws.tasks.length > 0 || ws.unassigned.length > 0)) {
    openDiscover()
  }
}

async function applyWorkspace(ws: WorkspaceTasks): Promise<void> {
  const before = store().workspace
  store().set({ workspace: ws })
  // Tarefa aberta ganhou uma worktree (criada por fora): libera e carrega a nova raiz.
  const active = store().activeTaskId
  const task = ws.tasks.find((t) => t.id === active)
  const prev = before?.tasks.find((t) => t.id === active)
  if (task && prev && task.worktrees.some((w) => !prev.worktrees.some((p) => p.path === w.path))) {
    await prepareTask(task.id)
  }
}

export function useTasksSync(): void {
  useEffect(() => {
    const offTasks = window.api.task.onChanged((ws) => {
      if (ws.root === root()) void applyWorkspace(ws)
    })
    // Status git das worktrees das tarefas abertas.
    const offGit = window.api.git.onChanged(({ root: changed }) => {
      if (changed in store().status) void refreshTaskStatus(changed)
    })
    const offFs = window.api.fs.onChanged(({ root: changed }) => {
      if (changed in store().status) void refreshTaskStatus(changed)
    })
    return () => {
      offTasks()
      offGit()
      offFs()
    }
  }, [])
}

export async function refreshTaskStatus(path: string): Promise<void> {
  const res = await window.api.git.status(path)
  if (res.ok) store().setStatus(path, res.data)
}

// Libera as worktrees da tarefa no main, observa e carrega cada raiz.
async function prepareTask(id: string): Promise<boolean> {
  const dir = root()
  if (!dir) return false
  const task = await attempt(window.api.task.open(dir, id), 'Erro ao abrir a tarefa')
  if (!task) return false
  const explorer = useExplorerStore.getState()
  await Promise.all(
    task.worktrees.map(async (w) => {
      await window.api.fs.watch(w.path)
      await window.api.git.watch(w.path)
      if (!(w.path in explorer.children)) await explorer.load(w.path)
      await refreshTaskStatus(w.path)
    }),
  )
  return true
}

// Abre a tarefa no próprio contexto (abas e terminais separados) e mostra o explorer dela.
export async function openTask(id: string): Promise<void> {
  if (!(await prepareTask(id))) return
  useQuickOpenStore.getState().invalidate()
  useContextStore.getState().activate(taskContext(id))
  store().set({ activeTaskId: id })
  const layout = useLayoutStore.getState()
  if (layout.activeView !== 'explorer' || !layout.sidebarVisible) layout.selectView('explorer')
}

// Volta ao contexto do workspace (a pasta aberta, sem tarefa).
export function showWorkspace(): void {
  useQuickOpenStore.getState().invalidate()
  useContextStore.getState().activate(WORKSPACE_CONTEXT)
  store().set({ activeTaskId: null })
}

export function openDiscover(): void {
  const dock = getDockApi()
  if (!dock) return
  const existing = dock.getPanel(DISCOVER_PANEL_ID)
  if (existing) {
    existing.api.setActive()
    return
  }
  dock.addPanel({
    id: DISCOVER_PANEL_ID,
    component: DISCOVER_COMPONENT,
    tabComponent: DISCOVER_TAB_COMPONENT,
    title: 'Descobrir tarefas',
  })
}

export function closeDiscover(): void {
  const dock = getDockApi()
  const panel = dock?.getPanel(DISCOVER_PANEL_ID)
  if (dock && panel) dock.removePanel(panel)
}

// Ações que alteram a configuração das tarefas e devolvem o workspace atualizado.
async function change(
  op: (dir: string) => Promise<import('@shared/types').Result<WorkspaceTasks>>,
  error: string,
): Promise<WorkspaceTasks | null> {
  const dir = root()
  if (!dir) return null
  const ws = await attempt(op(dir), error)
  if (ws) await applyWorkspace(ws)
  return ws
}

export const setGrouping = (g: TaskGrouping) =>
  change((d) => window.api.task.setGrouping(d, g), 'Erro ao mudar o agrupamento')
export const renameTask = (id: string, name: string) =>
  change((d) => window.api.task.rename(d, id, name), 'Erro ao renomear a tarefa')
export const moveWorktree = (path: string, target: string) =>
  change((d) => window.api.task.move(d, path, target), 'Erro ao mover a worktree')
export const ignoreWorktree = (path: string) =>
  change((d) => window.api.task.ignore(d, path), 'Erro ao ignorar a worktree')
export const setTaskHidden = (id: string, hidden: boolean) =>
  change((d) => window.api.task.setHidden(d, id, hidden), 'Erro ao atualizar a tarefa')
export const setTaskNotes = (id: string, notes: string) =>
  change((d) => window.api.task.setNotes(d, id, notes), 'Erro ao salvar as notas')
export const linkSession = (sessionId: string, id: string | null) =>
  change((d) => window.api.task.linkSession(d, sessionId, id), 'Erro ao vincular a sessão')
export const addExternalRepo = () =>
  change((d) => window.api.task.addExternalRepo(d), 'Erro ao adicionar o repositório')

export async function addRepoToTask(id: string, repo: string): Promise<void> {
  const ws = await change(
    (d) => window.api.task.addRepo(d, id, repo),
    'Erro ao adicionar o repositório à tarefa',
  )
  if (ws) toast.info('Worktree criada na tarefa.')
}

export async function importTasks(hidden: string[]): Promise<void> {
  const ws = await change((d) => window.api.task.import(d, hidden), 'Erro ao importar as tarefas')
  if (!ws) return
  closeDiscover()
  const shown = ws.tasks.filter((t) => !t.hidden).length
  toast.info(`${shown} ${shown === 1 ? 'tarefa importada' : 'tarefas importadas'}.`)
}
