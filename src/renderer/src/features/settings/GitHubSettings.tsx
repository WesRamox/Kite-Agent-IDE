import { useT } from '../../lib/i18n'
import { useLayoutStore } from '../../stores/layout.store'
import { closeModal } from '../../stores/modal.store'
import { login, logout } from '../github/github.actions'
import { useGitHubStore } from '../github/github.store'
import { BTN, REPO_URL } from './settings-sections'
import { Card, Row } from './settings-ui'

export function GitHubSettings() {
  const auth = useGitHubStore((s) => s.auth)
  const user = auth?.user ?? null
  const t = useT()
  if (!auth)
    return (
      <Card>
        <p className="px-4 py-3.5 text-fg-muted">{t('common.loading')}</p>
      </Card>
    )
  if (!auth.configured) {
    return (
      <Card>
        <Row title={t('settings.loginNotConfigured')} hint={t('settings.loginNotConfiguredHint')}>
          <button
            type="button"
            className={BTN}
            onClick={() => window.open(`${REPO_URL}#getting-started`, '_blank')}
          >
            {t('settings.howToConfigure')}
          </button>
        </Row>
      </Card>
    )
  }
  return (
    <Card>
      <Row
        title={user ? t('settings.connectedAs', { login: user.login }) : t('settings.notConnected')}
        hint={
          user
            ? auth.secureStorage
              ? t('settings.tokenSecure')
              : t('settings.tokenMemory')
            : t('settings.signInHint')
        }
      >
        {user ? (
          <span className="flex items-center gap-3">
            <img src={user.avatarUrl} alt="" className="size-6 rounded-full" />
            <button type="button" className={BTN} onClick={() => void logout()}>
              {t('settings.signOut')}
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={BTN}
            onClick={() => {
              closeModal()
              const layout = useLayoutStore.getState()
              if (layout.activeView !== 'github' || !layout.sidebarVisible)
                layout.selectView('github')
              void login()
            }}
          >
            {t('settings.signIn')}
          </button>
        )}
      </Row>
    </Card>
  )
}
