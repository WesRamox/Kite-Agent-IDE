import { useEffect } from 'react'
import { ActivityBar } from '../components/ActivityBar'
import { MainArea } from '../components/MainArea'
import { Sidebar } from '../components/Sidebar'
import { StatusBar } from '../components/StatusBar'
import { Toasts } from '../components/Toasts'
import { useAgentsSync } from '../features/agents/agents.actions'
import { useSessionsSync } from '../features/agents/sessions.actions'
import { useTasksSync } from '../features/tasks/tasks.actions'
import { useGitSync } from '../features/git/git-sync'
import { QuickOpen } from '../features/quick-open/QuickOpen'
import { TaskSwitcher } from '../features/tasks/TaskSwitcher'
import { useLayoutStore } from '../stores/layout.store'
import { useThemeStore } from '../stores/theme.store'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useCloseFlow } from './use-close-flow'
import { useFsEvents } from './use-fs-events'
import { useKeybindings } from './use-keybindings'

export function App() {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)
  useKeybindings()
  useFsEvents()
  useCloseFlow()
  useGitSync()
  useAgentsSync()
  useSessionsSync()
  useTasksSync()
  useEffect(() => {
    void useWorkspaceStore.getState().loadRecent()
    void useThemeStore.getState().syncFromMain()
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <div className={sidebarVisible ? 'flex' : 'hidden'}>
          <Sidebar />
        </div>
        <MainArea />
      </div>
      <StatusBar />
      <QuickOpen />
      <TaskSwitcher />
      <Toasts />
    </div>
  )
}
