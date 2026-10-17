import { RefreshCw } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { BranchPicker } from './BranchPicker'
import { ChangeList } from './ChangeList'
import { CommitBox } from './CommitBox'
import { refreshGit } from './git-sync'
import { stageAll, unstageAll } from './git.actions'
import { useGitStore } from './git.store'
import { WorktreeSection } from './WorktreeSection'
import { useT } from '../../lib/i18n'

export function GitPanel() {
  const root = useWorkspaceStore((s) => s.root)
  const status = useGitStore((s) => s.status)
  const t = useT()

  if (!root) {
    return <p className="px-4 py-6 text-center text-fg-muted">{t('git.openFolder')}</p>
  }
  if (!status) return <p className="px-4 py-6 text-center text-fg-muted">{t('common.loading')}</p>
  if (!status.isRepo) {
    return <p className="px-4 py-6 text-center text-fg-muted">{t('git.notRepo')}</p>
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
          title={t('git.refresh')}
          aria-label={t('git.refresh')}
          onClick={() => void refreshGit()}
          className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="mt-2">
        <CommitBox stagedCount={staged.length} />
      </div>
      <ChangeList
        title={t('git.staged')}
        root={root}
        files={staged}
        staged
        onAll={() => void unstageAll()}
      />
      <ChangeList
        title={t('git.changes')}
        root={root}
        files={unstaged}
        staged={false}
        onAll={() => void stageAll()}
      />
      {status.files.length === 0 && (
        <p className="px-3 py-3 text-center text-fg-muted">{t('git.noChanges')}</p>
      )}
      <WorktreeSection />
    </div>
  )
}
