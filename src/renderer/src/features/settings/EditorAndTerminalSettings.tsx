import { useT } from '../../lib/i18n'
import { useSettingsStore } from '../../stores/settings.store'
import { Card, FontStepper, Row, Switch } from './settings-ui'

export function EditorAndTerminalSettings() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const t = useT()
  return (
    <Card>
      <Row title={t('settings.editorFont')} hint={t('settings.editorFontHint')}>
        <FontStepper
          label={t('settings.editorFont')}
          value={settings.editorFontSize}
          onChange={(v) => void update({ editorFontSize: v })}
        />
      </Row>
      <Row title={t('settings.terminalFont')} hint={t('settings.terminalFontHint')}>
        <FontStepper
          label={t('settings.terminalFont')}
          value={settings.terminalFontSize}
          onChange={(v) => void update({ terminalFontSize: v })}
        />
      </Row>
      <Row title={t('settings.restoreTerminals')} hint={t('settings.restoreTerminalsHint')}>
        <Switch
          label={t('settings.restoreTerminals')}
          checked={settings.restoreTerminals}
          onChange={(v) => void update({ restoreTerminals: v })}
        />
      </Row>
    </Card>
  )
}
