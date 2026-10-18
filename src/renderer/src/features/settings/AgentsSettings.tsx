import { CLI_LABEL, CLIS } from '../../lib/agent-cli'
import { useT } from '../../lib/i18n'
import { closeModal } from '../../stores/modal.store'
import { useSettingsStore } from '../../stores/settings.store'
import { showAttentionView } from '../agents/attention.actions'
import { useAttentionStore } from '../agents/attention.store'
import { openConnectAgents } from '../agents/sessions.actions'
import { useSessionsStore } from '../agents/sessions.store'
import { BTN } from './settings-sections'
import { Card, Row, Switch } from './settings-ui'

export function AgentsSettings() {
  const hooks = useSessionsStore((s) => s.hooks)
  const notifications = useSettingsStore((s) => s.settings.notifications)
  const update = useSettingsStore((s) => s.update)
  const connected = CLIS.filter((cli) => hooks[cli]?.installed)
  const t = useT()
  return (
    <Card>
      <Row
        title={t('settings.integrations')}
        hint={
          connected.length > 0
            ? t('settings.connected', { list: connected.map((c) => CLI_LABEL[c]).join(', ') })
            : t('settings.noneConnected')
        }
      >
        <button type="button" className={BTN} onClick={openConnectAgents}>
          {t('settings.connectAgents')}
        </button>
      </Row>
      <Row title={t('settings.presets')} hint={t('settings.presetsHint')}>
        <button
          type="button"
          className={BTN}
          onClick={() => {
            closeModal()
            showAttentionView()
            useAttentionStore.getState().set({ mode: 'presets' })
          }}
        >
          {t('settings.adjust')}
        </button>
      </Row>
      <Row title={t('settings.notifications')} hint={t('settings.notificationsHint')}>
        <Switch
          label={t('settings.notifications')}
          checked={notifications}
          onChange={(v) => void update({ notifications: v })}
        />
      </Row>
    </Card>
  )
}
