import '@xterm/xterm/css/xterm.css'
import type { IDockviewPanelProps } from 'dockview-react'
import { useEffect, useRef, useState } from 'react'
import { handleTerminalExit, type TerminalParams } from './terminal.actions'
import type { TerminalSession } from './terminal-session'
import { useTerminalUiStore } from './terminal-ui.store'
import { getOrCreateSession } from './terminals'
import { TerminalSearch } from './TerminalSearch'

const FIT_DEBOUNCE_MS = 50

export function TerminalPanel({ api, params }: IDockviewPanelProps<TerminalParams>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [session, setSession] = useState<TerminalSession | null>(null)
  const searchOpen = useTerminalUiStore((s) => s.searchOpen === api.id)
  const closeSearch = useTerminalUiStore((s) => s.closeSearch)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const s = getOrCreateSession(api.id, {
      cwd: params.cwd,
      restore: params.restore,
      onExit: (event) => handleTerminalExit(api.id, event),
      onOpenSearch: () => useTerminalUiStore.getState().openSearch(api.id),
    })
    setSession(s)
    void s.attach(el).then(() => {
      if (api.isActive) s.focus()
    })

    // Resize do contêiner → fit (com debounce) → onResize do xterm → pty:resize.
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => s.fit(), FIT_DEBOUNCE_MS)
    })
    observer.observe(el)
    const subs = [
      api.onDidActiveChange(({ isActive }) => {
        if (isActive) {
          s.fit()
          s.focus()
        }
      }),
      api.onDidVisibilityChange(({ isVisible }) => isVisible && s.fit()),
    ]
    return () => {
      clearTimeout(timer)
      observer.disconnect()
      subs.forEach((d) => d.dispose())
    }
    // A sessão vive enquanto o painel existir; params só valem na criação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  return (
    <div className="relative h-full w-full bg-surface-0 py-1 pl-2">
      <div ref={containerRef} className="h-full w-full" />
      {searchOpen && session && <TerminalSearch session={session} onClose={closeSearch} />}
    </div>
  )
}
