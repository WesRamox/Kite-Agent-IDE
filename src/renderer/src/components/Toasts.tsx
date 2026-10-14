import { X } from 'lucide-react'
import { useToastStore, type ToastKind } from '../stores/toast.store'

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'border-accent/60',
  warning: 'border-amber-400/70',
  error: 'border-red-400/70',
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed right-4 bottom-10 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-2 rounded-md border-l-4 bg-surface-3 px-3 py-2 text-fg shadow-lg ${KIND_CLASS[t.kind]}`}
        >
          <span className="flex-1 select-text">{t.message}</span>
          <button
            type="button"
            aria-label="Fechar"
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
