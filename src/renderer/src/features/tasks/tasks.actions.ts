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
import { openAgentTerminal } from '../agents/agents.actions'
import { useAgentsStore } from '../agents/agents.store'
import { taskContext, useTasksStore } from './tasks.store'
import { closeModal } from '../../stores/modal.store'
import { t } from '../../lib/i18n'
import { basename } from '../../lib/paths'
import { copyText } from '../../lib/clipboard'

export const DISCOVER_COMPONENT = 'discover'
export const DISCOVER_TAB_COMPONENT = 'discover-tab'
const DISCOVER_PANEL_ID = 'discover'

export function isDiscoverPanel(id: string): boolean {
  return id === DISCOVER_PANEL_ID
}

const store = () => useTasksStore.getState()
const root = () => useWorkspaceStore.getState().root

// De onde o main tira o título e o resumo da tarefa.
const TASK_META_FILES = new Set(['TASK.md', '.kite-task.json'])

// Descobre as tarefas da pasta aberta e passa a observar as worktrees. Na primeira vez num
// workspace com worktrees, abre a tela de descoberta (canvas, tela 4).
export async function loadTasks(dir: string, opts: { fromOpen?: boolean } = {}): Promise<void> {
  const ws = await attempt(window.api.task.discover(dir), t('tasks.discoverError'))
  if (!ws || root() !== dir) return
  await applyWorkspace(ws)
  await attempt(window.api.task.watch(dir), t('tasks.watchError'))
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
    // TASK.md mudou (o agente escreveu o resumo, ou alguém trocou o título): relê as tarefas. O
    // mesmo arquivo chega pela pasta aberta e pela worktree, daí a espera curta para juntar.
    let metaTimer: ReturnType<typeof setTimeout> | undefined
    const offFs = window.api.fs.onChanged(({ root: changed, events }) => {
      if (changed in store().status) void refreshTaskStatus(changed)
      if (events.some((e) => TASK_META_FILES.has(basename(e.path)))) {
        clearTimeout(metaTimer)
        metaTimer = setTimeout(() => void refreshTasks(), 300)
      }
    })
    return () => {
      clearTimeout(metaTimer)
      offTasks()
      offGit()
      offFs()
    }
  }, [])
}

// PR de cada worktree (para os detalhes da tarefa). Sem GitHub ou sem login: nada.
async function loadPRs(id: string): Promise<void> {
  const dir = root()
  if (!dir) return
  const res = await window.api.review.prs(dir, id)
  if (res.ok) store().setPRs(res.data)
}

// Pedido pronto para colar no agente: escrever o resumo da tarefa no TASK.md dela.
export function copySummaryRequest(file: string): void {
  copyText(t('details.summaryPrompt', { file }))
  toast.info(t('details.summaryCopied'))
}

// Releitura em segundo plano: sem aviso de erro, a próxima mudança no arquivo tenta de novo.
async function refreshTasks(): Promise<void> {
  const dir = root()
  if (!dir) return
  const res = await window.api.task.discover(dir)
  if (res.ok && root() === dir) await applyWorkspace(res.data)
}

export async function refreshTaskStatus(path: string): Promise<void> {
  const res = await window.api.git.status(path)
  if (res.ok) store().setStatus(path, res.data)
}

// Libera as worktrees da tarefa no main, observa e carrega cada raiz.
async function prepareTask(id: string): Promise<boolean> {
  const dir = root()
  if (!dir) return false
  const task = await attempt(window.api.task.open(dir, id), t('tasks.openError'))
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
  closeModal()
  if (!(await prepareTask(id))) return
  useQuickOpenStore.getState().invalidate()
  useContextStore.getState().activate(taskContext(id))
  store().set({ activeTaskId: id })
  void loadPRs(id)
  const layout = useLayoutStore.getState()
  if (layout.activeView !== 'explorer' || !layout.sidebarVisible) layout.selectView('explorer')
}

// Volta ao contexto do workspace (a pasta aberta, sem tarefa).
export function showWorkspace(): void {
  closeModal()
  useQuickOpenStore.getState().invalidate()
  useContextStore.getState().activate(WORKSPACE_CONTEXT)
  store().set({ activeTaskId: null })
}

export function openDiscover(): void {
  closeModal()
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
    title: t('discover.tab'),
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
  change((d) => window.api.task.setGrouping(d, g), t('tasks.groupingError'))
export const renameTask = (id: string, name: string) =>
  change((d) => window.api.task.rename(d, id, name), t('tasks.renameError'))
export const moveWorktree = (path: string, target: string) =>
  change((d) => window.api.task.move(d, path, target), t('tasks.moveError'))
export const ignoreWorktree = (path: string) =>
  change((d) => window.api.task.ignore(d, path), t('tasks.ignoreError'))
export const setTaskHidden = (id: string, hidden: boolean) =>
  change((d) => window.api.task.setHidden(d, id, hidden), t('tasks.updateError'))
export const setTaskNotes = (id: string, notes: string) =>
  change((d) => window.api.task.setNotes(d, id, notes), t('tasks.notesError'))
export const linkSession = (sessionId: string, id: string | null) =>
  change((d) => window.api.task.linkSession(d, sessionId, id), t('tasks.linkError'))
export const addExternalRepo = () =>
  change((d) => window.api.task.addExternalRepo(d), t('tasks.addRepoError'))

export const removeRepo = (repo: string) =>
  change((d) => window.api.task.removeRepo(d, repo), t('tasks.removeRepoError'))
export const restoreRepo = (repo: string) =>
  change((d) => window.api.task.restoreRepo(d, repo), t('tasks.restoreRepoError'))
export const removeTask = (id: string) =>
  change((d) => window.api.task.remove(d, id), t('tasks.removeTaskError'))

export async function addRepoToTask(id: string, repo: string): Promise<void> {
  const ws = await change(
    (d) => window.api.task.addRepo(d, id, repo),
    t('tasks.addRepoToTaskError'),
  )
  if (ws) toast.info(t('tasks.worktreeCreated'))
}

// `imported` vão para a Central; `dismissed` ficam escondidas e não voltam à descoberta.
export async function importTasks(imported: string[], dismissed: string[]): Promise<void> {
  const ws = await change(
    (d) => window.api.task.import(d, imported, dismissed),
    t('tasks.importError'),
  )
  if (!ws) return
  closeDiscover()
  toast.info(t('tasks.imported', { n: imported.length }))
}

// "Nova tarefa" (Fase 10): cria as worktrees, abre a tarefa e, se pedido, o agente na pasta dela.
export async function createTaskWithAgent(input: {
  name: string
  branch: string
  repos: string[]
  presetId: string | null
  prompt: string
}): Promise<boolean> {
  const dir = root()
  if (!dir) return false
  const task = await attempt(
    window.api.task.create(dir, { name: input.name, branch: input.branch, repos: input.repos }),
    t('tasks.createError'),
  )
  if (!task) return false
  const ws = await attempt(window.api.task.discover(dir), t('tasks.refreshError'))
  if (ws) await applyWorkspace(ws)
  await openTask(task.id)
  if (!input.presetId) return true
  const agent = await attempt(
    window.api.agent.startInTask(dir, task.id, input.presetId, input.prompt),
    t('tasks.startAgentError'),
  )
  if (!agent) return true
  useAgentsStore.getState().upsert(agent)
  openAgentTerminal(agent.id)
  return true
}

// "+ Agente" nos terminais da tarefa aberta.
export async function startAgentInTask(taskId: string, presetId: string): Promise<void> {
  const dir = root()
  if (!dir) return
  const agent = await attempt(
    window.api.agent.startInTask(dir, taskId, presetId, ''),
    t('tasks.startAgentError'),
  )
  if (!agent) return
  useAgentsStore.getState().upsert(agent)
  openAgentTerminal(agent.id)
}
