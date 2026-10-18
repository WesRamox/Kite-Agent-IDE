import { THEMES } from '@shared/themes'
import { Check } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useThemeStore } from '../../stores/theme.store'

export function AppearanceSettings() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const tr = useT()
  return (
    <div
      role="radiogroup"
      aria-label={tr('settings.theme')}
      className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5"
    >
      {THEMES.map((t) => {
        const active = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col overflow-hidden rounded-[10px] border text-left transition-colors ${
              active ? 'border-accent' : 'border-border hover:border-fg-muted/40'
            }`}
          >
            {/* Miniatura: fundo do tema, uma "barra lateral" e linhas de código nas cores dele. */}
            <span className="flex h-[72px] gap-1.5 p-2" style={{ background: t.background }}>
              <span className="w-5 rounded-sm opacity-80" style={{ background: t.swatches[1] }} />
              <span className="flex flex-1 flex-col justify-center gap-1.5">
                <span className="h-1.5 w-3/4 rounded-full" style={{ background: t.swatches[2] }} />
                <span
                  className="h-1.5 w-1/2 rounded-full opacity-70"
                  style={{ background: t.swatches[1] }}
                />
                <span className="h-1.5 w-2/3 rounded-full" style={{ background: t.swatches[2] }} />
              </span>
            </span>
            <span className="flex items-center gap-2 bg-surface-1 px-3 py-2">
              <span className="flex-1 truncate">{tr(`theme.${t.id}`)}</span>
              {active && <Check size={14} className="text-accent" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
