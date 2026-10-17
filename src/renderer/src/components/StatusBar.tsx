import { FolderGit2, GitBranch, SquareTerminal } from 'lucide-react'
import { openCentral, showAttentionView } from '../features/agents/attention.actions'
import { openConnectAgents } from '../features/agents/sessions.actions'
import { useSessionsStore } from '../features/agents/sessions.store'
import { useAttentionGroups } from '../features/agents/use-attention'
import { useEditorStore } from '../features/editor/editor.store'
import { useGitStore } from '../features/git/git.store'
import { focusOrCreateTerminal } from '../features/terminal/terminal.actions'
import { basename } from '../lib/paths'
import { useLayoutStore } from '../stores/layout.store'
import { useActiveTask } from '../features/tasks/tasks.store'
import { useWorkspaceStore } from '../stores/workspace.store'

// Moldura do canvas (Main.dc.html e Task.dc.html): 26 px, contagens da Central à esquerda.
export function StatusBar() {
  const root = useWorkspaceStore((s) => s.root)
  const status = useGitStore((s) => s.status)
  const hooksInstalled = useSessionsStore((s) => s.hooks?.installed ?? false)
  const groups = useAttentionGroups()
  const task = useActiveTask()
  const taskBranch = task?.worktrees.find((w) => w.branch)?.branch ?? null
  const showGit = () => {
    const layout = useLayoutStore.getState()
    if (layout.activeView !== 'git' || !layout.sidebarVisible) layout.selectView('git')
  }
  const showCentral = () => {
    showAttentionView()
    openCentral()
  }
  const cursor = useEditorStore((s) => s.cursor)
  const language = useEditorStore((s) => (s.activePath ? s.tabs[s.activePath]?.language : null))
  const counts = [
    { n: groups.waiting.length, label: 'esperando você', className: 'text-accent' },
    { n: groups.running.length, label: 'trabalhando', className: '' },
    { n: groups.review.length, label: 'para revisar', className: '' },
  ].filter((c) => c.n > 0)

  return (
    <footer className="flex h-[26px] shrink-0 items-center gap-4 border-t border-border bg-surface-1 px-3 font-geist text-[11px] text-fg-muted">
      {task ? (
        <>
          <span>
            {task.key} · {task.worktrees.map((w) => w.repoName).join(', ')}
          </span>
          {taskBranch && <span>branch {taskBranch}</span>}
        </>
      ) : status?.isRepo ? (
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
      {counts.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={showCentral}
          className={`hover:text-fg ${c.className}`}
        >
          ● {c.n} {c.label}
        </button>
      ))}
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
        {cursor && (
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
        )}
        {language && <span>{language}</span>}
        <button type="button" onClick={openConnectAgents} className="hover:text-fg">
          {hooksInstalled ? 'Claude Code conectado' : 'Conectar Claude Code'}
        </button>
      </span>
    </footer>
  )
}
