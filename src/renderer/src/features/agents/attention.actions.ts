import { getDockApi } from '../../lib/dock'
import { useLayoutStore } from '../../stores/layout.store'
import { toast } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { focusTerminalByPty, openTerminal } from '../terminal/terminal.actions'
import { openAgentTerminal } from './agents.actions'
import { useAgentsStore } from './agents.store'
import { nextWaiting, type AttentionItem } from './attention'
import { useAttentionStore } from './attention.store'
import { useSessionsStore } from './sessions.store'
import { useTasksStore } from '../tasks/tasks.store'
import { buildItems } from './use-attention'

export const ATTENTION_COMPONENT = 'attention'
export const ATTENTION_TAB_COMPONENT = 'attention-tab'
const ATTENTION_PANEL_ID = 'attention'

export function isAttentionPanel(id: string): boolean {
  return id === ATTENTION_PANEL_ID
}

export function currentItems(now = Date.now()): AttentionItem[] {
  return buildItems(
    useSessionsStore.getState().sessions,
    useAgentsStore.getState().tasks,
    useTasksStore.getState().workspace,
    now,
  )
}

// Abre (ou foca) a Central de atenção na área principal.
export function openCentral(): void {
  const dock = getDockApi()
  if (!dock) return
  const existing = dock.getPanel(ATTENTION_PANEL_ID)
  if (existing) {
    existing.api.setActive()
    return
  }
  const first = dock.panels[0]
  dock.addPanel({
    id: ATTENTION_PANEL_ID,
    component: ATTENTION_COMPONENT,
    tabComponent: ATTENTION_TAB_COMPONENT,
    title: 'Central de atenção',
    ...(first ? { position: { referencePanel: first.id, direction: 'within' as const } } : {}),
  })
}

export function showAttentionView(): void {
  const layout = useLayoutStore.getState()
  if (layout.activeView !== 'attention' || !layout.sidebarVisible) layout.selectView('attention')
}

// Destaca o item na Central; se ele roda num terminal do Kite, vai até o terminal.
export function focusItem(item: AttentionItem): void {
  useAttentionStore.getState().set({ highlighted: item.id })
  openCentral()
  if (item.inKite && item.group === 'waiting') respond(item)
}

// "Responder no terminal": a aba do agente ou o terminal do Kite em que ele roda.
export function respond(item: AttentionItem): void {
  if (item.task) {
    openAgentTerminal(item.task.id)
    return
  }
  const pty = item.session?.ptyId
  if (pty && focusTerminalByPty(pty)) return
  toast.info('O terminal desta sessão foi fechado. Use "Retomar aqui" para continuar.')
}

function resumeCommand(item: AttentionItem): string | null {
  return item.session ? `claude --resume ${item.session.id}` : null
}

function inside(dir: string, root: string): boolean {
  const base = root.endsWith('/') || root.endsWith('\\') ? root : `${root}/`
  return dir === root || dir.startsWith(base)
}

// "Retomar aqui": abre a sessão num terminal do Kite, na pasta em que ela rodava.
export async function resumeHere(item: AttentionItem): Promise<void> {
  const command = resumeCommand(item)
  const session = item.session
  if (!command || !session) return
  const root = useWorkspaceStore.getState().root
  if (!root || !inside(session.cwd, root)) {
    await window.api.clipboard.writeText(command)
    toast.info(
      `A sessão roda em ${session.cwd}, fora da pasta aberta. O comando foi copiado: abra essa pasta ou rode-o num terminal lá.`,
    )
    return
  }
  if (session.status !== 'ended') {
    const answer = await window.api.dialog.confirm({
      message: 'A sessão ainda está aberta em outro terminal.',
      detail: 'Retomar aqui abre uma segunda cópia. O ideal é fechar a outra antes.',
      buttons: ['Retomar aqui mesmo assim', 'Cancelar'],
      kind: 'warning',
    })
    if (!answer.ok || answer.data !== 0) return
  }
  openTerminal({ cwd: session.cwd, input: command, title: 'Claude (retomado)' })
}

export async function copyResume(item: AttentionItem): Promise<void> {
  const command = resumeCommand(item)
  if (!command) return
  await window.api.clipboard.writeText(command)
  toast.info('Comando copiado.')
}

// Ctrl/Cmd+J: o próximo agente que espera, do que espera há mais tempo.
export function jumpToNextWaiting(): void {
  const items = currentItems()
  const next = nextWaiting(items, useAttentionStore.getState().highlighted)
  if (!next) {
    toast.info('Nenhum agente esperando você.')
    return
  }
  focusItem(next)
}
