import { useAttentionGroups } from '../features/agents/use-attention'
import { VIEWS } from '../lib/views'
import { useLayoutStore } from '../stores/layout.store'
import { KiteLogo } from './KiteLogo'
import { Settings } from 'lucide-react'
import { openSettings } from '../features/settings/settings.actions'

// Moldura do canvas (Main.dc.html): logo no topo, botões de 36 px, badge de quem espera.
export function ActivityBar() {
  const activeView = useLayoutStore((s) => s.activeView)
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)
  const selectView = useLayoutStore((s) => s.selectView)
  const waiting = useAttentionGroups().waiting.length

  return (
    <nav
      aria-label="Atividades"
      className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-surface-1 py-2.5"
    >
      <KiteLogo size={26} className="mb-2.5" />
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const active = sidebarVisible && activeView === id
        const badge = id === 'attention' && waiting > 0
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={badge ? `${label}, ${waiting} esperando` : label}
            aria-pressed={active}
            onClick={() => selectView(id)}
            className={`relative flex size-9 items-center justify-center rounded-lg transition-colors ${
              active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <Icon size={18} strokeWidth={1.8} />
            {badge && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-lg bg-accent px-1 font-geist text-[10px] font-semibold text-accent-fg">
                {waiting}
              </span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        title="Configurações"
        aria-label="Configurações"
        onClick={openSettings}
        className="mt-auto flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Settings size={18} strokeWidth={1.8} />
      </button>
    </nav>
  )
}
