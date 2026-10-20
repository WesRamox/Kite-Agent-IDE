import { X } from 'lucide-react'
import { useToastStore, type ToastKind } from '../stores/toast.store'
import { useT } from '../lib/i18n'

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'border-accent/60',
  warning: 'border-warning/70',
  error: 'border-danger/70',
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const tr = useT()

  return (
    <div className="pointer-events-none fixed right-4 bottom-10 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-2 rounded-md border-l-4 bg-surface-3 px-3 py-2 text-fg shadow-lg ${KIND_CLASS[t.kind]}`}
        >
          <span className="flex-1 select-text">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.run()
                dismiss(t.id)
              }}
              className="shrink-0 rounded px-1.5 text-xs font-semibold text-accent hover:bg-surface-2"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label={tr('toast.close')}
            onClick={() => dismiss(t.id)}
            className="text-fg-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
