import { AttentionSidebar } from '../features/agents/AttentionSidebar'
import { ExplorerPanel } from '../features/explorer/ExplorerPanel'
import { GitPanel } from '../features/git/GitPanel'
import { GitHubPanel } from '../features/github/GitHubPanel'
import { VIEWS } from '../lib/views'
import { useTasksStore } from '../features/tasks/tasks.store'
import { useLayoutStore } from '../stores/layout.store'
import { SidebarResizer } from './SidebarResizer'
import { useT } from '../lib/i18n'

// Moldura do canvas (Main.dc.html): 288 px por padrão (ajustável pela borda), fundo surface-1,
// cabeçalho em versalete.
export function Sidebar() {
  const activeView = useLayoutStore((s) => s.activeView)
  const width = useLayoutStore((s) => s.sidebarWidth)
  const view = VIEWS.find((v) => v.id === activeView)
  const taskOpen = useTasksStore((s) => s.activeTaskId !== null)
  // A Central e o explorer da tarefa têm cabeçalho próprio.
  const ownHeader = activeView === 'attention' || (activeView === 'explorer' && taskOpen)
  const t = useT()
  const pane = (id: string) => (activeView === id ? 'flex min-h-0 flex-1 flex-col' : 'hidden')

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-r border-border bg-surface-1 font-geist"
    >
      {/* A Central tem cabeçalho próprio ("Tarefas" + "+ Nova"). */}
      {!ownHeader && (
        <header className="flex h-10 shrink-0 items-center px-3.5 text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
          {view && t(view.label)}
        </header>
      )}
      {/* Os painéis ficam montados (só escondidos) para não perder estado ao trocar de aba. */}
      <div className={pane('attention')}>
        <AttentionSidebar />
      </div>
      <div className={pane('explorer')}>
        <ExplorerPanel />
      </div>
      <div className={pane('git')}>
        <GitPanel />
      </div>
      <div className={pane('github')}>
        <GitHubPanel />
      </div>
      <SidebarResizer />
    </aside>
  )
}
