import { ActivityBar } from '../components/ActivityBar'
import { MainArea } from '../components/MainArea'
import { Sidebar } from '../components/Sidebar'
import { StatusBar } from '../components/StatusBar'
import { useLayoutStore } from '../stores/layout.store'

export function App() {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        {sidebarVisible && <Sidebar />}
        <MainArea />
      </div>
      <StatusBar />
    </div>
  )
}
