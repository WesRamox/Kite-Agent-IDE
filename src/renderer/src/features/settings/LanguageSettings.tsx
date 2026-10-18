import { useT } from '../../lib/i18n'
import { useSettingsStore } from '../../stores/settings.store'
import { Card } from './settings-ui'

export function LanguageSettings() {
  const language = useSettingsStore((s) => s.settings.language)
  const update = useSettingsStore((s) => s.update)
  const t = useT()
  // Cada idioma aparece no próprio idioma, como de costume.
  const options = [
    { id: 'pt-BR', label: 'Português (Brasil)' },
    { id: 'en', label: 'English' },
  ] as const
  return (
    <Card>
      <div role="radiogroup" aria-label={t('settings.languageGroup')} className="flex flex-col">
        {options.map((o) => (
          <label
            key={o.id}
            className="flex items-center gap-2.5 border-b border-border px-4 py-3 last:border-b-0"
          >
            <input
              type="radio"
              name="language"
              checked={language === o.id}
              onChange={() => void update({ language: o.id })}
              className="accent-accent"
            />
            <span className="flex-1" lang={o.id}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </Card>
  )
}
