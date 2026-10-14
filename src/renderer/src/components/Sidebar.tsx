import { ExplorerPanel } from '../features/explorer/ExplorerPanel'
import { VIEWS } from '../lib/views'
import { useLayoutStore } from '../stores/layout.store'

export function Sidebar() {
  const activeView = useLayoutStore((s) => s.activeView)
  const view = VIEWS.find((v) => v.id === activeView)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-1">
      <header className="flex h-9 shrink-0 items-center px-4 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
        {view?.label}
      </header>
      {activeView === 'explorer' ? (
        <ExplorerPanel />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-fg-muted">
          Disponível em uma próxima fase.
        </div>
      )}
    </aside>
  )
}
