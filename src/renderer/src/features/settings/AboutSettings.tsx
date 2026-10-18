import { useT } from '../../lib/i18n'
import { useAppInfo } from '../../lib/use-app-info'
import { BTN, REPO_URL } from './settings-sections'
import { Card, Row } from './settings-ui'

export function AboutSettings() {
  const info = useAppInfo()
  const t = useT()
  return (
    <Card>
      <Row
        title={info ? `${info.name} ${info.version}` : 'Kite'}
        hint={
          info
            ? t('settings.versions', {
                electron: info.versions.electron,
                chrome: info.versions.chrome,
                node: info.versions.node,
              })
            : undefined
        }
      >
        <span className="flex gap-2">
          <button type="button" className={BTN} onClick={() => window.open(REPO_URL, '_blank')}>
            {t('settings.projectOnGitHub')}
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => window.open(`${REPO_URL}/issues/new`, '_blank')}
          >
            {t('settings.reportIssue')}
          </button>
        </span>
      </Row>
    </Card>
  )
}
