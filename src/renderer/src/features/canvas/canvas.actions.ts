import type {
  CanvasNodeColor,
  CanvasNodeData,
  CanvasState,
  FileEncoding,
  WorkspaceCanvas,
} from '@shared/types'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react'
import { findPanel, getDockApi } from '../../lib/dock'
import { t } from '../../lib/i18n'
import { attempt } from '../../lib/ipc'
import { closeModal } from '../../stores/modal.store'
import { toast } from '../../stores/toast.store'
import { basename } from '../../lib/paths'
import { useQuickOpenStore } from '../quick-open/quick-open.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useTasksStore } from '../tasks/tasks.store'
import { getSession } from '../terminal/terminal.actions'
import {
  EDGE_TYPE,
  EMPTY_STATE,
  canvasSessionId,
  edgeId,
  fromFlow,
  newId,
  newNode,
  NODE_SIZE,
  toFlowEdges,
  toFlowNodes,
  type FlowNode,
} from './canvas'
import { useCanvasStore } from './canvas.store'
import { codeHandles } from './canvas.registry'

export const CANVAS_COMPONENT = 'canvas'
export const CANVAS_TAB_COMPONENT = 'canvas-tab'
const CANVAS_PANEL_ID = 'canvas'

export function isCanvasPanel(id: string): boolean {
  return id === CANVAS_PANEL_ID
}

const store = () => useCanvasStore.getState()

// Abre o quadro como aba do contexto atual, para ficar lado a lado com o código se a pessoa
// quiser. O quadro é um só: aberto em outra tarefa, ele vem para esta.
export function openCanvas(): void {
  closeModal()
  const dock = getDockApi()
  if (!dock) return
  const here = dock.getPanel(CANVAS_PANEL_ID)
  if (here) {
    here.api.setActive()
    return
  }
  const other = findPanel(CANVAS_PANEL_ID)
  if (other) other.dock.removePanel(other.panel)
  dock.addPanel({
    id: CANVAS_PANEL_ID,
    component: CANVAS_COMPONENT,
    tabComponent: CANVAS_TAB_COMPONENT,
    title: t('canvas.tab'),
  })
}

export async function loadCanvas(root: string): Promise<void> {
  const canvas = await attempt(window.api.canvas.load(root), t('canvas.loadError'))
  if (!canvas || useWorkspaceStore.getState().root !== root) return
  const current = canvas.boards.find((b) => b.id === canvas.active) ?? canvas.boards[0]
  if (!current) return
  store().set({
    root,
    active: current.id,
    boards: canvas.boards.map(({ id, name }) => ({ id, name })),
    others: Object.fromEntries(
      canvas.boards.filter((b) => b.id !== current.id).map((b) => [b.id, b.state]),
    ),
    ...flowOf(current.state),
    status: 'saved',
  })
}

const flowOf = (state: CanvasState) => ({
  nodes: toFlowNodes(state),
  edges: toFlowEdges(state),
  viewport: state.viewport,
})

const snapshot = (): CanvasState => {
  const { nodes, edges, viewport } = store()
  return fromFlow(nodes, edges, viewport)
}

// Grava pouco depois da última mudança: arrastar um bloco gera dezenas de mudanças seguidas.
let saveTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSave(): void {
  clearTimeout(saveTimer)
  store().set({ status: 'saving' })
  saveTimer = setTimeout(() => void saveCanvas(), 400)
}

export async function saveCanvas(): Promise<void> {
  clearTimeout(saveTimer)
  const { root, active, boards, others } = store()
  if (!root || !active) return
  store().set({ status: 'saving' })
  const canvas: WorkspaceCanvas = {
    active,
    boards: boards.map((b) => ({
      ...b,
      state: b.id === active ? snapshot() : (others[b.id] ?? EMPTY_STATE),
    })),
  }
  const ok = await attempt(window.api.canvas.save(root, canvas), t('canvas.saveError'))
  if (store().root === root) store().set({ status: ok === null ? 'error' : 'saved' })
}

// Troca o workflow aberto: o atual vai para a gaveta e o escolhido vem para o quadro.
export function switchWorkflow(id: string): void {
  const { active, others } = store()
  const target = others[id]
  if (id === active || !target) return
  const rest = Object.fromEntries(Object.entries(others).filter(([key]) => key !== id))
  store().set({ active: id, others: { ...rest, [active]: snapshot() }, ...flowOf(target) })
  scheduleSave()
}

// Nome sugerido para um workflow novo: o da tarefa aberta (ou "Workflow N"), sem repetir.
export function suggestedWorkflowName(): string {
  const { activeTaskId, workspace } = useTasksStore.getState()
  const task = workspace?.tasks.find((x) => x.id === activeTaskId)
  const boards = store().boards
  const base = task?.name ?? t('canvas.newName', { n: boards.length + 1 })
  const taken = new Set(boards.map((b) => b.name))
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base} (${n})`
  return name.slice(0, 80)
}

// Nome sugerido no "Salvar": se o workflow ainda tem um nome padrão e há uma tarefa aberta, o
// nome da tarefa; senão, o nome atual.
export function suggestedSaveName(current: string): string {
  const generic = current === t('canvas.firstName') || /^Workflow \d+$/.test(current)
  const { activeTaskId, workspace } = useTasksStore.getState()
  const task = workspace?.tasks.find((x) => x.id === activeTaskId)
  return generic && task ? task.name.slice(0, 80) : current
}

export function newWorkflow(): void {
  const { active, boards, others } = store()
  const id = newId('wf')
  store().set({
    active: id,
    boards: [...boards, { id, name: suggestedWorkflowName() }],
    others: { ...others, [active]: snapshot() },
    ...flowOf(EMPTY_STATE),
  })
  scheduleSave()
}

// "Salvar como": guarda uma cópia do quadro atual com outro nome e segue nela; o original fica
// como estava.
export function saveWorkflowAs(name: string): void {
  const trimmed = name.trim().slice(0, 80)
  if (!trimmed) return
  const { active, boards, others } = store()
  const id = newId('wf')
  const current = snapshot()
  store().set({
    active: id,
    boards: [...boards, { id, name: trimmed }],
    others: { ...others, [active]: current },
    ...flowOf(current),
  })
  void saveCanvas()
}

// Ctrl+S com o quadro na frente: grava na hora e avisa.
export async function saveCanvasNow(): Promise<void> {
  await saveCanvas()
  if (store().status === 'saved') toast.info(t('canvas.savedToast'))
}

// "Iniciar <agente> aqui" num terminal do quadro: o main monta o comando (com as ferramentas do
// quadro, no Claude Code) e ele é digitado no shell do bloco.
export async function startAgentInNode(nodeId: string, presetId: string): Promise<void> {
  const command = await attempt(
    window.api.canvas.launchCommand(presetId, nodeId),
    t('canvas.startAgentError'),
  )
  if (command) getSession(canvasSessionId(nodeId))?.type(`${command}\r`)
}

// Bloco de código: escolhe um arquivo das pastas da tarefa pela busca de arquivos (Ctrl+P).
export function pickCodeFile(id: string): void {
  useQuickOpenStore
    .getState()
    .showPicker((path) =>
      patchNode(id, (d) => (d.kind === 'code' ? { ...d, path, text: undefined } : d)),
    )
}

export async function saveCodeFile(
  path: string,
  text: string,
  encoding: FileEncoding,
): Promise<boolean> {
  const ok = await attempt(
    window.api.fs.writeFile(path, text, encoding),
    t('editor.saveError', { file: basename(path) }),
  )
  if (ok !== null) toast.info(t('canvas.fileSaved', { file: basename(path) }))
  return ok !== null
}

// Ctrl+S dentro de um bloco de código ligado a um arquivo: salva o arquivo.
export function saveFocusedCode(target: EventTarget | null): boolean {
  const id =
    target instanceof Element
      ? target.closest('[data-canvas-code]')?.getAttribute('data-canvas-code')
      : null
  const save = id ? codeHandles.get(id)?.save : null
  if (!save) return false
  void save()
  return true
}

export function renameWorkflow(id: string, name: string): void {
  const trimmed = name.trim().slice(0, 80)
  if (!trimmed) return
  store().set({ boards: store().boards.map((b) => (b.id === id ? { ...b, name: trimmed } : b)) })
  scheduleSave()
}

// Apagar perde os blocos e ligações daquele workflow: pede confirmação.
export async function deleteWorkflow(id: string): Promise<void> {
  const { boards } = store()
  const board = boards.find((b) => b.id === id)
  if (!board || boards.length < 2) return
  const answer = await window.api.dialog.confirm({
    message: t('canvas.deleteConfirm', { name: board.name }),
    detail: t('canvas.deleteDetail'),
    buttons: [t('canvas.delete'), t('common.cancel')],
    kind: 'warning',
  })
  if (!answer.ok || answer.data !== 0) return
  if (store().active === id) {
    const next = store().boards.find((b) => b.id !== id)
    if (next) switchWorkflow(next.id)
  }
  const { others } = store()
  store().set({
    boards: store().boards.filter((b) => b.id !== id),
    others: Object.fromEntries(Object.entries(others).filter(([key]) => key !== id)),
  })
  scheduleSave()
}

export function onNodesChange(changes: NodeChange<FlowNode>[]): void {
  store().set({ nodes: applyNodeChanges(changes, store().nodes) })
  if (changes.some((c) => c.type !== 'select')) scheduleSave()
}

export function onEdgesChange(changes: EdgeChange[]): void {
  store().set({ edges: applyEdgeChanges(changes, store().edges) })
  if (changes.some((c) => c.type !== 'select')) scheduleSave()
}

export function connect(c: Connection): void {
  if (c.source === c.target) return
  const edge: Edge = { ...c, id: edgeId(c), type: EDGE_TYPE }
  store().set({ edges: addEdge(edge, store().edges) })
  scheduleSave()
}

export function setViewport(viewport: Viewport): void {
  store().set({ viewport })
  scheduleSave()
}

export function addNode(
  data: CanvasNodeData,
  position: { x: number; y: number },
  size?: { width: number; height: number },
): void {
  const node = newNode(data, position, size)
  store().set({ nodes: [...store().nodes.map((n) => ({ ...n, selected: false })), node] })
  scheduleSave()
}

// Nome dado pela pessoa ao bloco; vazio volta ao nome do tipo.
export function setNodeLabel(id: string, label: string): void {
  const trimmed = label.trim().slice(0, 80)
  patchNode(id, (data) => {
    const { label: _old, ...rest } = data
    return trimmed ? { ...rest, label: trimmed } : rest
  })
}

export function setNodeColor(id: string, color: CanvasNodeColor | null): void {
  patchNode(id, (data) => {
    const { color: _old, ...rest } = data
    return color ? { ...rest, color } : rest
  })
}

// Muda os dados de um bloco a partir dos atuais (mantém nome e cor que a pessoa deu).
export function patchNode(id: string, fn: (data: CanvasNodeData) => CanvasNodeData): void {
  store().set({ nodes: store().nodes.map((n) => (n.id === id ? { ...n, data: fn(n.data) } : n)) })
  scheduleSave()
}

export function removeNode(id: string): void {
  const { nodes, edges } = store()
  store().set({
    nodes: nodes.filter((n) => n.id !== id),
    edges: edges.filter((e) => e.source !== id && e.target !== id),
  })
  scheduleSave()
}

// Cópia do bloco, um pouco abaixo e à direita, do mesmo tamanho.
export function duplicateNode(id: string): void {
  const node = store().nodes.find((n) => n.id === id)
  if (!node) return
  const size = {
    width: node.width ?? NODE_SIZE[node.data.kind].width,
    height: node.height ?? NODE_SIZE[node.data.kind].height,
  }
  addNode(node.data, { x: node.position.x + 40, y: node.position.y + 40 }, size)
}

export function disconnectNode(id: string): void {
  store().set({ edges: store().edges.filter((e) => e.source !== id && e.target !== id) })
  scheduleSave()
}

// Terminal novo abre na pasta da tarefa aberta (ou na primeira worktree dela); sem tarefa, na
// pasta aberta.
export function terminalCwd(): string | null {
  const { activeTaskId, workspace } = useTasksStore.getState()
  const task = workspace?.tasks.find((x) => x.id === activeTaskId)
  return task?.folder ?? task?.worktrees[0]?.path ?? useWorkspaceStore.getState().root
}

export function removeEdge(id: string): void {
  store().set({ edges: store().edges.filter((e) => e.id !== id) })
  scheduleSave()
}
