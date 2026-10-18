import { FolderGit2, GitBranch, SquareTerminal } from 'lucide-react'
import { openCentral, showAttentionView } from '../features/agents/attention.actions'
import { CLI_LABEL, CLIS } from '../lib/agent-cli'
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
import { useT } from '../lib/i18n'

// Moldura do canvas (Main.dc.html e Task.dc.html): 26 px, contagens da Central à esquerda.
export function StatusBar() {
  const root = useWorkspaceStore((s) => s.root)
  const status = useGitStore((s) => s.status)
  // "Claude Code conectado" (ou o primeiro CLI conectado); nenhum: convite para conectar.
  const t = useT()
  const connectedCli = useSessionsStore((s) => CLIS.find((c) => s.hooks[c]?.installed) ?? null)
  const connectedLabel = connectedCli
    ? t('status.connected', { cli: CLI_LABEL[connectedCli] })
    : null
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
    { n: groups.waiting.length, label: t('status.waiting'), className: 'text-accent' },
    { n: groups.running.length, label: t('status.running'), className: '' },
    { n: groups.review.length, label: t('status.review'), className: '' },
  ].filter((c) => c.n > 0)

  return (
    <footer className="flex h-[26px] shrink-0 items-center gap-4 border-t border-border bg-surface-1 px-3 font-geist text-[11px] text-fg-muted">
      {task ? (
        <>
          <span>
            {task.key} · {task.worktrees.map((w) => w.repoName).join(', ')}
          </span>
          {taskBranch && <span>{t('status.branch', { branch: taskBranch })}</span>}
        </>
      ) : status?.isRepo ? (
        <>
          <button
            type="button"
            title={t('status.currentBranch')}
            onClick={showGit}
            className="flex items-center gap-1 hover:text-fg"
          >
            <GitBranch size={12} />
            {status.branch ?? `(${status.head ?? t('status.noCommits')})`}
            {status.files.length > 0 && <span className="text-warning">*</span>}
          </button>
          <span title={status.worktreePath} className="flex items-center gap-1">
            <FolderGit2 size={12} />
            {status.isMainWorktree ? t('status.mainWorktree') : basename(status.worktreePath)}
          </span>
        </>
      ) : (
        <span>{t('status.noRepo')}</span>
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
          title={t('status.terminalTitle')}
          onClick={focusOrCreateTerminal}
          className="flex items-center gap-1 hover:text-fg"
        >
          <SquareTerminal size={12} /> {t('status.terminal')}
        </button>
      )}
      <span className="ml-auto flex gap-4">
        {cursor && <span>{t('status.cursor', { line: cursor.line, column: cursor.column })}</span>}
        {language && <span>{language}</span>}
        <button type="button" onClick={openConnectAgents} className="hover:text-fg">
          {connectedLabel ?? t('status.connectClaude')}
        </button>
      </span>
    </footer>
  )
}
