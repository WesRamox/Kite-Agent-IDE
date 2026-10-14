import { useEffect } from 'react'
import { ActivityBar } from '../components/ActivityBar'
import { MainArea } from '../components/MainArea'
import { Sidebar } from '../components/Sidebar'
import { StatusBar } from '../components/StatusBar'
import { Toasts } from '../components/Toasts'
import { useGitSync } from '../features/git/git-sync'
import { QuickOpen } from '../features/quick-open/QuickOpen'
import { useLayoutStore } from '../stores/layout.store'
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
  useEffect(() => {
    void useWorkspaceStore.getState().loadRecent()
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
      <Toasts />
    </div>
  )
}
