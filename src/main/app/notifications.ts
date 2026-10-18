import { Notification } from 'electron'
import type { AgentCli, AgentSession, AgentTask } from '@shared/types'
import { t } from '../lib/i18n'
import type { MainWindowRef } from './main-window'

const AGENT_MESSAGES: Record<string, (name: string, code: number | null) => [string, string]> = {
  waiting: (name) => [t('notify.agentWaiting', { name }), t('notify.agentWaitingBody')],
  done: (name) => [t('notify.agentDone', { name }), t('notify.agentDoneBody')],
  error: (name, code) => [
    t('notify.agentFailed', { name }),
    code === null ? t('notify.agentInterrupted') : t('notify.agentExitCode', { code }),
  ],
}

const CLI_NAME: Record<AgentCli, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }

const SESSION_MESSAGES: Record<string, (s: AgentSession) => [string, string]> = {
  permission: (s) => [
    t('notify.sessionPermission', { cli: CLI_NAME[s.cli] }),
    s.pending ? `${s.pending.tool}: ${s.pending.detail}`.trim() : (s.lastMessage ?? ''),
  ],
  turn: (s) => [t('notify.sessionTurn', { cli: CLI_NAME[s.cli] }), s.lastMessage ?? ''],
  input: (s) => [t('notify.sessionInput', { cli: CLI_NAME[s.cli] }), s.lastMessage ?? ''],
}

export interface NotifierDeps {
  window: MainWindowRef
  // Configuração "notificações" do usuário, lida a cada aviso.
  enabled: () => boolean
}

// Notificações nativas; clicar traz a janela e foca a tarefa ou a sessão.
export function createNotifier(deps: NotifierDeps) {
  const show = (title: string, body: string, onClick: () => void): void => {
    if (!deps.enabled() || !Notification.isSupported()) return
    const notification = new Notification({ title, body })
    notification.on('click', () => {
      if (deps.window.reveal()) onClick()
    })
    notification.show()
  }

  return {
    // Agente aberto pelo Kite (status pelo terminal ou pelos hooks).
    agent(task: AgentTask): void {
      const message = AGENT_MESSAGES[task.status]
      if (!message) return
      const [title, body] = message(task.name, task.exitCode)
      show(title, body, () => deps.window.emit('agent:focus', { id: task.id }))
    },
    // Sessão vista pelos hooks (agente dentro ou fora do Kite).
    session(session: AgentSession): void {
      const message = session.waitReason ? SESSION_MESSAGES[session.waitReason] : undefined
      if (!message) return
      const [title, body] = message(session)
      show(title, body.slice(0, 180), () =>
        deps.window.emit('agentSession:focus', { id: session.id }),
      )
    },
  }
}

export type Notifier = ReturnType<typeof createNotifier>
