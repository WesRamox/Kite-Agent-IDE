import { useEffect } from 'react'
import { useModalStore } from '../../stores/modal.store'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { currentItems, focusItem, openCentral, showAttentionView } from './attention.actions'
import type { AgentCli, HooksStatus } from '@shared/types'
import { CLI_LABEL, CLIS } from './cli'
import { useSessionsStore } from './sessions.store'
import { t } from '../../lib/i18n'

const store = () => useSessionsStore.getState()

export async function loadSessions(): Promise<boolean> {
  const [sessions, ...statuses] = await Promise.all([
    window.api.agentSession.list(),
    ...CLIS.map((c) => window.api.hooks.status(c)),
  ])
  const hooks: Partial<Record<AgentCli, HooksStatus>> = {}
  for (const st of statuses) if (st.ok) hooks[st.data.cli] = st.data
  store().set({ ...(sessions.ok ? { sessions: sessions.data } : {}), hooks })
  return Object.values(hooks).some((h) => h?.installed)
}

// Mantém as sessões em dia com os hooks e reage ao clique nas notificações.
export function useSessionsSync(): void {
  useEffect(() => {
    // Com o Claude Code conectado, o app abre na sidebar da Central (canvas, tela 1). A Central em si
    // é uma janela sobreposta e só abre quando pedida.
    void loadSessions().then((connected) => {
      if (connected) showAttentionView()
    })
    const offChanged = window.api.agentSession.onChanged((s) => store().upsert(s))
    const offFocus = window.api.agentSession.onFocus(({ id }) => {
      const item = currentItems().find(
        (x) => x.session?.id === id || x.sessions.some((s) => s.id === id),
      )
      showAttentionView()
      if (item) focusItem(item)
      else openCentral()
    })
    return () => {
      offChanged()
      offFocus()
    }
  }, [])
}

// Abre "Conectar agentes" numa janela sobreposta.
export function openConnectAgents(): void {
  useModalStore.getState().show('connect')
}

export async function installHooks(cli: AgentCli = 'claude'): Promise<void> {
  const status = await attempt(
    window.api.hooks.install(cli),
    t('connect.installError', { cli: CLI_LABEL[cli] }),
  )
  if (!status) return
  store().set({ hooks: { ...store().hooks, [cli]: status } })
  toast.info(
    cli === 'codex' ? t('connect.codexInstalled') : t('connect.installed', { cli: CLI_LABEL[cli] }),
  )
}

export async function uninstallHooks(cli: AgentCli = 'claude'): Promise<void> {
  const status = await attempt(window.api.hooks.uninstall(cli), t('connect.uninstallError'))
  if (status) store().set({ hooks: { ...store().hooks, [cli]: status } })
}
