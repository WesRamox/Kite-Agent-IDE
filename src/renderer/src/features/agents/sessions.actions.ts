import { useEffect } from 'react'
import { getDockApi } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { currentItems, focusItem, openCentral, showAttentionView } from './attention.actions'
import { useSessionsStore } from './sessions.store'

export const CONNECT_COMPONENT = 'connect-agents'
export const CONNECT_TAB_COMPONENT = 'connect-agents-tab'
const CONNECT_PANEL_ID = 'connect-agents'

export function isConnectPanel(id: string): boolean {
  return id === CONNECT_PANEL_ID
}

const store = () => useSessionsStore.getState()

export async function loadSessions(): Promise<boolean> {
  const [sessions, hooks] = await Promise.all([
    window.api.agentSession.list(),
    window.api.hooks.status(),
  ])
  store().set({
    ...(sessions.ok ? { sessions: sessions.data } : {}),
    ...(hooks.ok ? { hooks: hooks.data } : {}),
  })
  return hooks.ok && hooks.data.installed
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

export async function installHooks(): Promise<void> {
  const status = await attempt(window.api.hooks.install(), 'Erro ao conectar o Claude Code')
  if (!status) return
  store().set({ hooks: status })
  toast.info('Claude Code conectado. Vale para as sessões abertas a partir de agora.')
}

export async function uninstallHooks(): Promise<void> {
  const status = await attempt(window.api.hooks.uninstall(), 'Erro ao remover a integração')
  if (status) store().set({ hooks: status })
}
