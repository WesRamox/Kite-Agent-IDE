import { useModalStore } from '../../stores/modal.store'
import { useLayoutStore } from '../../stores/layout.store'
import { toast } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { focusTerminalByPty, openTerminal } from '../terminal/terminal.actions'
import { openAgentTerminal } from './agents.actions'
import { useAgentsStore } from './agents.store'
import { nextWaiting, type AttentionItem } from './attention'
import { RESUME } from './cli'
import { useAttentionStore } from './attention.store'
import { useSessionsStore } from './sessions.store'
import { useTasksStore } from '../tasks/tasks.store'
import { buildItems } from './use-attention'
import { t } from '../../lib/i18n'

export function currentItems(now = Date.now()): AttentionItem[] {
  const { sessions, pending, dismissed } = useSessionsStore.getState()
  return buildItems(
    sessions,
    useAgentsStore.getState().tasks,
    useTasksStore.getState().workspace,
    now,
    { pending, dismissed: new Set(dismissed) },
  )
}

// Abre a Central de atenção numa janela sobreposta.
export function openCentral(): void {
  useModalStore.getState().show('central')
}

export function showAttentionView(): void {
  const layout = useLayoutStore.getState()
  if (layout.activeView !== 'attention' || !layout.sidebarVisible) layout.selectView('attention')
}

// Destaca o item e abre o terminal em que ele roda: a aba de um agente do Kite (mesmo
// encerrado, para ver o que ele fez) ou o terminal do Kite de uma sessão viva. Sem terminal no
// Kite, mostra o item na Central.
export function focusItem(item: AttentionItem): void {
  useAttentionStore.getState().set({ highlighted: item.id })
  if (item.task) openAgentTerminal(item.task.id)
  else if (
    !item.session?.ptyId ||
    item.session.status === 'ended' ||
    !focusTerminalByPty(item.session.ptyId)
  )
    openCentral()
}

// "Responder no terminal": a aba do agente ou o terminal do Kite em que ele roda.
export function respond(item: AttentionItem): void {
  if (item.task) {
    openAgentTerminal(item.task.id)
    return
  }
  const pty = item.session?.ptyId
  if (pty && focusTerminalByPty(pty)) return
  toast.info(t('resume.terminalClosed'))
}

function resumeCommand(item: AttentionItem): string | null {
  return item.session ? `${RESUME[item.session.cli]} ${item.session.id}` : null
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
    toast.info(t('resume.outside', { cwd: session.cwd }))
    return
  }
  if (session.status !== 'ended') {
    const answer = await window.api.dialog.confirm({
      message: t('resume.stillOpen'),
      detail: t('resume.stillOpenDetail'),
      buttons: [t('resume.anyway'), t('common.cancel')],
      kind: 'warning',
    })
    if (!answer.ok || answer.data !== 0) return
  }
  openTerminal({ cwd: session.cwd, input: command, title: t('resume.terminalTitle') })
}

export async function copyResume(item: AttentionItem): Promise<void> {
  const command = resumeCommand(item)
  if (!command) return
  await window.api.clipboard.writeText(command)
  toast.info(t('resume.copied'))
}

// Ctrl/Cmd+J: o próximo agente que espera, do que espera há mais tempo.
export function jumpToNextWaiting(): void {
  const items = currentItems()
  const next = nextWaiting(items, useAttentionStore.getState().highlighted)
  if (!next) {
    toast.info(t('resume.noneWaiting'))
    return
  }
  focusItem(next)
}
