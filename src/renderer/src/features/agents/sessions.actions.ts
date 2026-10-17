import { useEffect } from 'react'
import { getDockApi } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { currentItems, focusItem, openCentral, showAttentionView } from './attention.actions'
import type { AgentCli, HooksStatus } from '@shared/types'
import { CLI_LABEL, CLIS } from './cli'
import { useSessionsStore } from './sessions.store'

export const CONNECT_COMPONENT = 'connect-agents'
export const CONNECT_TAB_COMPONENT = 'connect-agents-tab'
const CONNECT_PANEL_ID = 'connect-agents'

export function isConnectPanel(id: string): boolean {
  return id === CONNECT_PANEL_ID
}

const store = () => useSessionsStore.getState()

// Carrega as sessões e a integração de cada CLI; true se algum CLI está conectado.
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
    // Com o Claude Code conectado, o app abre na Central de atenção (canvas, tela 1).
    void loadSessions().then((connected) => {
      if (!connected) return
      showAttentionView()
      openCentral()
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

export function openConnectAgents(): void {
  const dock = getDockApi()
  if (!dock) return
  const existing = dock.getPanel(CONNECT_PANEL_ID)
  if (existing) {
    existing.api.setActive()
    return
  }
  dock.addPanel({
    id: CONNECT_PANEL_ID,
    component: CONNECT_COMPONENT,
    tabComponent: CONNECT_TAB_COMPONENT,
    title: 'Conectar agentes',
  })
}

export async function installHooks(cli: AgentCli = 'claude'): Promise<void> {
  const status = await attempt(
    window.api.hooks.install(cli),
    `Erro ao conectar o ${CLI_LABEL[cli]}`,
  )
  if (!status) return
  store().set({ hooks: { ...store().hooks, [cli]: status } })
  toast.info(
    cli === 'codex'
      ? 'Codex conectado. Na primeira sessão, o Codex pede para revisar e confiar nos hooks.'
      : `${CLI_LABEL[cli]} conectado. Vale para as sessões abertas a partir de agora.`,
  )
}

export async function uninstallHooks(cli: AgentCli = 'claude'): Promise<void> {
  const status = await attempt(window.api.hooks.uninstall(cli), 'Erro ao remover a integração')
  if (status) store().set({ hooks: { ...store().hooks, [cli]: status } })
}
