import { VIEWS } from '../lib/views'
import { useLayoutStore } from '../stores/layout.store'

export function ActivityBar() {
  const activeView = useLayoutStore((s) => s.activeView)
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)
  const selectView = useLayoutStore((s) => s.selectView)

  return (
    <nav className="flex w-12 flex-col items-center gap-1 border-r border-border bg-surface-1 py-2">
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const active = sidebarVisible && activeView === id
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => selectView(id)}
            className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
              active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <Icon size={20} strokeWidth={1.75} />
          </button>
        )
      })}
    </nav>
  )
}
