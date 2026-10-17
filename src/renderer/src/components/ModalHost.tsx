import { Inbox, Plug, Settings, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CentralPanel } from '../features/agents/CentralPanel'
import { ConnectAgentsPanel } from '../features/agents/ConnectAgentsPanel'
import { SettingsPanel } from '../features/settings/SettingsPanel'
import { type ModalId, useModalStore } from '../stores/modal.store'

const MODALS: Record<ModalId, { title: string; icon: LucideIcon; body: () => React.ReactNode }> = {
  central: { title: 'Central de atenção', icon: Inbox, body: () => <CentralPanel /> },
  connect: { title: 'Conectar agentes', icon: Plug, body: () => <ConnectAgentsPanel /> },
  settings: { title: 'Configurações', icon: Settings, body: () => <SettingsPanel /> },
}

// Janela sobreposta: fundo escurecido, cabeçalho com o título e o X. Esc (na captura, antes do
// editor e do terminal) ou um clique fora fecham.
export function ModalHost() {
  const open = useModalStore((s) => s.open)
  const close = useModalStore((s) => s.close)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      // Volta o foco para onde estava (editor, terminal), se ainda existir.
      if (previous?.isConnected) previous.focus()
    }
  }, [open, close])

  if (!open) return null
  const modal = MODALS[open]
  const Icon = modal.icon
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-6 backdrop-blur-[1px]"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={modal.title}
        tabIndex={-1}
        className="flex h-[min(860px,100%)] w-[min(1180px,100%)] flex-col overflow-hidden rounded-xl border border-border bg-surface-0 shadow-2xl outline-none"
      >
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-1 pr-2 pl-4 font-geist text-[13px]">
          <Icon size={15} className="text-accent" />
          <span className="flex-1 font-medium text-fg">{modal.title}</span>
          <span className="mr-1 font-geist-mono text-[11px] text-fg-muted">Esc</span>
          <button
            type="button"
            aria-label={`Fechar ${modal.title}`}
            onClick={close}
            className="flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <X size={15} />
          </button>
        </header>
        <div className="min-h-0 flex-1">{modal.body()}</div>
      </div>
    </div>
  )
}
