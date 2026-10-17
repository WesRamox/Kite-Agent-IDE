import { useAgentsStore } from '../features/agents/agents.store'
import { waitingCount } from '../features/agents/session-format'
import { useSessionsStore } from '../features/agents/sessions.store'
import { VIEWS } from '../lib/views'
import { ThemePicker } from './ThemePicker'
import { useLayoutStore } from '../stores/layout.store'

export function ActivityBar() {
  const activeView = useLayoutStore((s) => s.activeView)
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)
  const selectView = useLayoutStore((s) => s.selectView)
  const tasks = useAgentsStore((s) => s.tasks)
  const sessions = useSessionsStore((s) => s.sessions)
  const waiting = waitingCount(sessions, tasks)

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
            className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
              active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <Icon size={20} strokeWidth={1.75} />
            {id === 'agents' && waiting > 0 && (
              <span
                aria-label={`${waiting} esperando você`}
                className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-geist text-[10px] font-semibold text-accent-fg"
              >
                {waiting}
              </span>
            )}
          </button>
        )
      })}
      <div className="mt-auto">
        <ThemePicker />
      </div>
    </nav>
  )
}
