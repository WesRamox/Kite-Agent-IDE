import { useEffect } from 'react'
import { useModalStore } from '../../stores/modal.store'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { currentItems, focusItem, openCentral, showAttentionView } from './attention.actions'
import type { AgentCli, HooksStatus } from '@shared/types'
import { CLI_LABEL, CLIS } from './cli'
import { reviewCandidate, reviewKey, type AttentionItem } from './attention'
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

// Confere quais sessões encerradas ainda deixaram arquivos sem commit: as que não deixaram saem
// de "Para revisar".
export async function refreshPending(): Promise<void> {
  const now = Date.now()
  const ids = store()
    .sessions.filter((s) => reviewCandidate(s, now))
    .map((s) => s.id)
  const res = ids.length > 0 ? await window.api.agentSession.pending(ids) : null
  if (res && !res.ok) return
  const pending = res?.data ?? {}
  if (JSON.stringify(pending) !== JSON.stringify(store().pending)) store().set({ pending })
}

export async function dismissReview(item: AttentionItem): Promise<void> {
  const key = reviewKey(item)
  if (!key) return
  const dismissed = await attempt(window.api.agentSession.dismiss(key), t('central.dismissError'))
  if (dismissed) store().set({ dismissed })
}

// Mantém as sessões em dia com os hooks e reage ao clique nas notificações.
export function useSessionsSync(): void {
  useEffect(() => {
    // Com o Claude Code conectado, o app abre na sidebar da Central (canvas, tela 1). A Central em si
    // é uma janela sobreposta e só abre quando pedida.
    void loadSessions().then((connected) => {
      void refreshPending()
      if (connected) showAttentionView()
    })
    void window.api.agentSession.dismissed().then((res) => {
      if (res.ok) store().set({ dismissed: res.data })
    })
    // Commits podem acontecer fora do Kite: confere de tempos em tempos, ao voltar para a janela
    // e quando uma sessão muda.
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void refreshPending(), 1000)
    }
    const offStore = useSessionsStore.subscribe((s, prev) => {
      if (s.sessions !== prev.sessions) soon()
    })
    const interval = setInterval(() => void refreshPending(), 30_000)
    window.addEventListener('focus', soon)
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
      offStore()
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('focus', soon)
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
