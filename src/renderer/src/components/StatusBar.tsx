import { Bot, FolderGit2, GitBranch, SquareTerminal } from 'lucide-react'
import { useAgentsStore } from '../features/agents/agents.store'
import { waitingCount } from '../features/agents/session-format'
import { openConnectAgents } from '../features/agents/sessions.actions'
import { useSessionsStore } from '../features/agents/sessions.store'
import { useEditorStore } from '../features/editor/editor.store'
import { useGitStore } from '../features/git/git.store'
import { focusOrCreateTerminal } from '../features/terminal/terminal.actions'
import { basename } from '../lib/paths'
import { useLayoutStore } from '../stores/layout.store'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useAppInfo } from '../lib/use-app-info'

export function StatusBar() {
  const info = useAppInfo()
  const root = useWorkspaceStore((s) => s.root)
  const status = useGitStore((s) => s.status)
  const running = useAgentsStore((s) => s.tasks.filter((t) => t.alive).length)
  const tasks = useAgentsStore((s) => s.tasks)
  const sessions = useSessionsStore((s) => s.sessions)
  const hooksInstalled = useSessionsStore((s) => s.hooks?.installed ?? false)
  const waiting = waitingCount(sessions, tasks)
  const showGit = () => {
    const layout = useLayoutStore.getState()
    if (layout.activeView !== 'git' || !layout.sidebarVisible) layout.selectView('git')
  }
  const cursor = useEditorStore((s) => s.cursor)
  const language = useEditorStore((s) => (s.activePath ? s.tabs[s.activePath]?.language : null))

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-surface-1 px-3 text-[11px] text-fg-muted">
      {status?.isRepo ? (
        <>
          <button
            type="button"
            title="Branch atual"
            onClick={showGit}
            className="flex items-center gap-1 hover:text-fg"
          >
            <GitBranch size={12} />
            {status.branch ?? `(${status.head ?? 'sem commits'})`}
            {status.files.length > 0 && <span className="text-warning">*</span>}
          </button>
          <span title={status.worktreePath} className="flex items-center gap-1">
            <FolderGit2 size={12} />
            {status.isMainWorktree ? 'worktree principal' : basename(status.worktreePath)}
          </span>
        </>
      ) : (
        <span>sem repositório</span>
      )}
      <button
        type="button"
        title="Agentes"
        onClick={() => {
          const layout = useLayoutStore.getState()
          if (layout.activeView !== 'agents' || !layout.sidebarVisible) layout.selectView('agents')
        }}
        className="flex items-center gap-1 hover:text-fg"
      >
        <Bot size={12} />
        {running} {running === 1 ? 'agente' : 'agentes'}
      </button>
      {waiting > 0 && <span className="text-accent">● {waiting} esperando você</span>}
      {root && (
        <button
          type="button"
          title="Terminal (Ctrl+`)"
          onClick={focusOrCreateTerminal}
          className="flex items-center gap-1 hover:text-fg"
        >
          <SquareTerminal size={12} /> Terminal
        </button>
      )}
      <span className="ml-auto flex gap-4">
        <button type="button" onClick={openConnectAgents} className="hover:text-fg">
          {hooksInstalled ? 'Claude Code conectado' : 'Conectar Claude Code'}
        </button>
        {cursor && (
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
        )}
        {language && <span>{language}</span>}
        {info && <span>v{info.version}</span>}
      </span>
    </footer>
  )
}
