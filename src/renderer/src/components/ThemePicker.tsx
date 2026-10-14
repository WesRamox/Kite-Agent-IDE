import { THEMES } from '@shared/themes'
import { Check, Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useThemeStore } from '../stores/theme.store'

export function ThemePicker() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close, true)
    // Captura: o terminal e o editor consomem o Escape antes da fase de bolha.
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', close, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Tema"
        aria-label="Tema"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Palette size={20} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Temas"
          className="absolute bottom-0 left-full z-50 ml-2 w-56 rounded-lg border border-border bg-surface-2 p-1 shadow-xl"
        >
          <p className="px-2 py-1 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
            Tema
          </p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-fg hover:bg-surface-3"
            >
              <span className="flex overflow-hidden rounded border border-border">
                {t.swatches.map((c) => (
                  <span key={c} className="size-3.5" style={{ background: c }} />
                ))}
              </span>
              <span className="flex-1">{t.label}</span>
              {theme === t.id && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
