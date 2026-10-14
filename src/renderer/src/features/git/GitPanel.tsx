import { RefreshCw } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { BranchPicker } from './BranchPicker'
import { ChangeList } from './ChangeList'
import { CommitBox } from './CommitBox'
import { refreshGit } from './git-sync'
import { stageAll, unstageAll } from './git.actions'
import { useGitStore } from './git.store'
import { WorktreeSection } from './WorktreeSection'

export function GitPanel() {
  const root = useWorkspaceStore((s) => s.root)
  const status = useGitStore((s) => s.status)

  if (!root) {
    return <p className="px-4 py-6 text-center text-fg-muted">Abra uma pasta para usar o Git.</p>
  }
  if (!status) return <p className="px-4 py-6 text-center text-fg-muted">Carregando…</p>
  if (!status.isRepo) {
    return (
      <p className="px-4 py-6 text-center text-fg-muted">Esta pasta não é um repositório Git.</p>
    )
  }

  const staged = status.files.filter((f) => f.staged)
  const unstaged = status.files.filter((f) => f.unstaged)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="flex items-center gap-1 pr-2">
        <div className="min-w-0 flex-1">
          <BranchPicker />
        </div>
        <button
          type="button"
          title="Atualizar"
          aria-label="Atualizar"
          onClick={() => void refreshGit()}
          className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="mt-2">
        <CommitBox stagedCount={staged.length} />
      </div>
      <ChangeList title="Stage" root={root} files={staged} staged onAll={() => void unstageAll()} />
      <ChangeList
        title="Alterações"
        root={root}
        files={unstaged}
        staged={false}
        onAll={() => void stageAll()}
      />
      {status.files.length === 0 && (
        <p className="px-3 py-3 text-center text-fg-muted">Nenhuma alteração.</p>
      )}
      <WorktreeSection />
    </div>
  )
}
