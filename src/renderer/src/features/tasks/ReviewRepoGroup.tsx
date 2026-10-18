import type { GitChangeKind, ReviewFile, ReviewRepo } from '@shared/types'
import { useT } from '../../lib/i18n'
import { SMALL_BTN } from './review-ui'

const STATUS: Record<GitChangeKind, { letter: string; color: string }> = {
  added: { letter: 'A', color: 'text-success' },
  untracked: { letter: 'A', color: 'text-success' },
  deleted: { letter: 'D', color: 'text-danger' },
  modified: { letter: 'M', color: 'text-warning' },
  renamed: { letter: 'R', color: 'text-warning' },
  copied: { letter: 'C', color: 'text-warning' },
  typechange: { letter: 'T', color: 'text-warning' },
  conflicted: { letter: '!', color: 'text-danger' },
}

function delta(f: ReviewFile): string {
  if (f.added === null || f.deleted === null) return '—'
  if (f.deleted === 0) return `+${f.added}`
  if (f.added === 0) return `−${f.deleted}`
  return `+${f.added} −${f.deleted}`
}

export interface Selected {
  worktree: string
  rel: string
}

export function RepoGroup(props: {
  repo: ReviewRepo
  selected: Selected | null
  onSelect: (rel: string) => void
  onCommit: () => void
  onPR: () => void
}) {
  const { repo } = props
  const tr = useT()
  return (
    <div className="mb-3.5" role="group" aria-label={tr('review.repo', { repo: repo.repoName })}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="font-geist-mono font-semibold">{repo.repoName}</span>
        <span className="truncate text-[11px] text-fg-muted">
          {repo.branch ?? tr('review.noBranch')}
        </span>
        <span className="ml-auto font-geist-mono text-[11px]">
          <span className="text-success">+{repo.added}</span>{' '}
          <span className="text-danger">−{repo.deleted}</span>
        </span>
      </div>
      {repo.error && <p className="px-[22px] py-1 text-xs text-danger">{repo.error}</p>}
      {repo.files.map((f) => {
        const st = STATUS[f.status]
        const active = props.selected?.worktree === repo.worktree && props.selected.rel === f.rel
        return (
          <button
            key={f.rel}
            type="button"
            onClick={() => props.onSelect(f.rel)}
            className={`flex h-7 w-full items-center gap-2 rounded-[5px] pr-2.5 pl-[22px] text-left ${
              active ? 'bg-surface-3' : 'hover:bg-surface-2'
            }`}
          >
            <span className={`w-3.5 font-geist-mono text-[11px] ${st.color}`}>{st.letter}</span>
            <span className="min-w-0 flex-1 truncate">{f.rel}</span>
            <span className="font-geist-mono text-[11px] text-fg-muted">{delta(f)}</span>
          </button>
        )
      })}
      <div className="flex flex-wrap gap-1.5 pt-1.5 pl-[22px]">
        <button
          type="button"
          disabled={repo.uncommitted === 0}
          onClick={props.onCommit}
          className={`${SMALL_BTN} disabled:opacity-50`}
        >
          {tr('review.commitIn', { repo: repo.repoName })}
        </button>
        {repo.pr ? (
          <a
            href={repo.pr.url}
            target="_blank"
            rel="noreferrer"
            className={`${SMALL_BTN} inline-flex items-center`}
          >
            PR #{repo.pr.number}
          </a>
        ) : (
          <button
            type="button"
            disabled={repo.files.length === 0 && repo.ahead === 0}
            onClick={props.onPR}
            className={`${SMALL_BTN} disabled:opacity-50`}
          >
            {tr('review.openPR')}
          </button>
        )}
      </div>
    </div>
  )
}
