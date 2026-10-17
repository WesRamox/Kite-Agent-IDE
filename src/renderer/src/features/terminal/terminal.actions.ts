import type { PtyExitEvent, TerminalSession as SavedSession } from '@shared/types'
import { allDocks, findPanel, getDock, getDockApi, WORKSPACE_CONTEXT } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { taskBaseDir } from '../tasks/tasks.store'
import {
  disposeSession,
  getSession,
  isAgentPanel,
  isTerminalPanel,
  panelByPty,
  TERMINAL_PREFIX,
} from './terminals'

export const TERMINAL_COMPONENT = 'terminal'
const INITIAL_HEIGHT = 280

export interface TerminalParams {
  cwd?: string
  restore?: string
  // Digitado no shell assim que ele abre.
  input?: string
  // Painel que mostra o terminal de um agente (o PTY pertence ao main).
  agentTaskId?: string
}

let counter = 0
let lastTerminalId: string | null = null

export function noteActivePanel(id: string | null): void {
  if (id && isTerminalPanel(id)) lastTerminalId = id
}

// Terminais de um contexto (padrão: o ativo).
function terminalPanels(dock = getDockApi()): string[] {
  return dock?.panels.map((p) => p.id).filter(isTerminalPanel) ?? []
}

export interface OpenTerminalOptions {
  restore?: SavedSession
  // Cria ao lado de um terminal existente.
  reference?: string
  direction?: 'right' | 'below' | 'within'
  // Pasta do shell (padrão: a pasta aberta) e texto a digitar quando ele abrir.
  cwd?: string
  input?: string
  title?: string
}

export function openTerminal(opts: OpenTerminalOptions = {}): string | null {
  const dock = getDockApi()
  const root = useWorkspaceStore.getState().root
  if (!dock) return null
  if (!root) {
    toast.info('Abra uma pasta para usar o terminal.')
    return null
  }

  counter += 1
  const id = `${TERMINAL_PREFIX}${counter}`
  const params: TerminalParams = {
    // Na tarefa, a pasta dela (ou a primeira worktree); senão, a pasta aberta.
    cwd: opts.cwd ?? taskBaseDir() ?? root,
    restore: opts.restore?.scrollback,
    input: opts.input,
  }
  const base = {
    id,
    component: TERMINAL_COMPONENT,
    tabComponent: TERMINAL_COMPONENT,
    title: opts.restore?.title ?? opts.title ?? `Terminal ${counter}`,
    params,
  }

  const reference =
    opts.reference ?? (lastTerminalId && dock.getPanel(lastTerminalId) ? lastTerminalId : null)
  if (reference) {
    dock.addPanel({
      ...base,
      position: { referencePanel: reference, direction: opts.direction ?? 'within' },
    })
  } else if (dock.panels.length > 0) {
    // Primeiro terminal: grupo próprio abaixo dos editores.
    dock.addPanel({ ...base, position: { direction: 'below' }, initialHeight: INITIAL_HEIGHT })
  } else {
    dock.addPanel(base)
  }
  lastTerminalId = id
  return id
}

export function splitTerminal(reference: string, direction: 'right' | 'below'): void {
  openTerminal({ reference, direction })
}

// Ctrl+`: foca o último terminal usado ou cria um.
export function focusOrCreateTerminal(): void {
  const dock = getDockApi()
  const panel = lastTerminalId ? dock?.getPanel(lastTerminalId) : undefined
  if (panel && lastTerminalId) {
    panel.api.setActive()
    getSession(lastTerminalId)?.focus()
    return
  }
  openTerminal()
}

// Foca o terminal (do Kite) em que roda o PTY; false se ele não estiver aberto.
export function focusTerminalByPty(ptyId: string): boolean {
  const id = panelByPty(ptyId)
  const panel = id ? getDockApi()?.getPanel(id) : undefined
  if (!id || !panel) return false
  panel.api.setActive()
  getSession(id)?.focus()
  return true
}

export function closeTerminal(id: string): void {
  disposeSession(id)
  const found = findPanel(id)
  if (found) found.dock.removePanel(found.panel)
  if (lastTerminalId === id) lastTerminalId = terminalPanels().at(-1) ?? null
}

// Shell encerrado: fecha a aba se saiu normalmente, senão mostra o código e mantém.
export function handleTerminalExit(id: string, { exitCode }: PtyExitEvent): void {
  if (isAgentPanel(id)) {
    getSession(id)?.write(`\r\n\x1b[2m[agente encerrado com código ${exitCode}]\x1b[0m\r\n`)
    return
  }
  if (exitCode === 0) {
    closeTerminal(id)
    return
  }
  getSession(id)?.write(`\r\n\x1b[2m[processo encerrado com código ${exitCode}]\x1b[0m\r\n`)
}

// Terminais do workspace (os das tarefas não são restaurados ao reabrir).
export function collectSessions(): SavedSession[] {
  const dock = getDock(WORKSPACE_CONTEXT)
  return terminalPanels(dock).flatMap((id) => {
    const session = getSession(id)
    const title = dock?.getPanel(id)?.title ?? 'Terminal'
    return session ? [{ title, scrollback: session.serialize() }] : []
  })
}

export async function saveTerminalSessions(root: string): Promise<void> {
  await attempt(
    window.api.terminal.saveSessions(root, collectSessions()),
    'Erro ao salvar terminais',
  )
}

export function closeAllTerminals(): void {
  for (const dock of allDocks()) for (const id of terminalPanels(dock)) closeTerminal(id)
  counter = 0
  lastTerminalId = null
}

export async function restoreTerminalSessions(root: string): Promise<void> {
  const saved = await attempt(window.api.terminal.loadSessions(root), 'Erro ao restaurar terminais')
  for (const session of saved ?? []) openTerminal({ restore: session })
}
