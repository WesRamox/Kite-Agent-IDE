import { FONT_MAX, FONT_MIN } from '@shared/settings'
import { Minus, Plus } from 'lucide-react'
import { type ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import type { SectionId } from './settings-sections'

// Peças da página de configurações, no visual do canvas (cards em surface-1).
export function Section({
  id,
  title,
  children,
}: {
  id: SectionId
  title: string
  children: ReactNode
}) {
  return (
    <section id={`settings-${id}`} aria-label={title} className="flex scroll-mt-6 flex-col gap-2.5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

// Linha de um card: título e explicação à esquerda, controle à direita.
export function Row({
  title,
  hint,
  children,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <span className="font-medium">{title}</span>
        {hint && <span className="text-xs leading-[1.45] text-fg-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] border border-border bg-surface-1">{children}</div>
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-surface-3'
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-fg transition-[left] ${
          checked ? 'left-[18px] bg-accent-fg' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function FontStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const t = useT()
  const btn =
    'flex size-[30px] items-center justify-center text-fg-muted hover:bg-surface-3 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center overflow-hidden rounded-[7px] border border-border bg-surface-0"
    >
      <button
        type="button"
        aria-label={t('settings.decrease', { label })}
        disabled={value <= FONT_MIN}
        onClick={() => onChange(value - 1)}
        className={btn}
      >
        <Minus size={13} />
      </button>
      <span className="w-14 text-center font-geist-mono text-xs" aria-live="polite">
        {value} px
      </span>
      <button
        type="button"
        aria-label={t('settings.increase', { label })}
        disabled={value >= FONT_MAX}
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
