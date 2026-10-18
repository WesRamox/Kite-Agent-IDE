import type { IDockviewPanelProps } from 'dockview-react'
import { ExternalLink } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useIssueDetail } from './use-github-detail'

export function IssuePanel({ params }: IDockviewPanelProps<{ number: number }>) {
  const { data: issue, error } = useIssueDetail(params.number)
  const t = useT()

  if (error) return <p className="p-6 text-danger">{error}</p>
  if (!issue)
    return (
      <p className="p-6 text-fg-muted">{t('github.loadingIssue', { number: params.number })}</p>
    )

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl p-6">
        <h1 className="text-lg text-fg select-text">
          {issue.title} <span className="text-fg-muted">#{issue.number}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-fg-muted">
          <span className="rounded-full bg-surface-3 px-2 text-[11px] text-fg">
            {issue.state === 'open' ? t('github.issue.open') : t('github.issue.closed')}
          </span>
          {t('github.issueBy', { author: issue.author ?? '?', n: issue.comments })}
          {issue.labels.map((l) => (
            <span
              key={l.name}
              className="rounded-full border px-1.5 text-[11px]"
              style={{ borderColor: `#${l.color}` }}
            >
              {l.name}
            </span>
          ))}
        </p>
        <button
          type="button"
          onClick={() => window.open(issue.url, '_blank')}
          className="mt-4 flex items-center gap-1.5 rounded-md border border-border px-3 py-1 hover:bg-surface-2"
        >
          <ExternalLink size={14} /> {t('github.openOnGitHub')}
        </button>
        <div className="mt-6 rounded-md border border-border bg-surface-1 p-4 whitespace-pre-wrap text-fg select-text">
          {issue.body.trim() || <span className="text-fg-muted">{t('github.noDescription')}</span>}
        </div>
      </article>
    </div>
  )
}
