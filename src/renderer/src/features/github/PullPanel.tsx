import type { IDockviewPanelProps } from 'dockview-react'
import type { PullDetail } from '@shared/types'
import { ExternalLink, FolderGit2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useGitStore } from '../git/git.store'
import { runState } from './checks'
import { CheckIcon } from './CheckIcon'
import { checkoutPull } from './github.actions'
import { useT } from '../../lib/i18n'

export function PullPanel({ params }: IDockviewPanelProps<{ number: number }>) {
  const root = useGitStore((s) => s.root)
  const [pr, setPr] = useState<PullDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const t = useT()

  const load = useCallback(async () => {
    if (!root) return
    const res = await window.api.github.getPR(root, params.number)
    if (res.ok) {
      setPr(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
  }, [root, params.number])

  useEffect(() => {
    let alive = true
    if (root) {
      void window.api.github.getPR(root, params.number).then((res) => {
        if (!alive) return
        if (res.ok) setPr(res.data)
        else setError(res.error.message)
      })
    }
    return () => {
      alive = false
    }
  }, [root, params.number])

  if (error) return <p className="p-6 text-danger">{error}</p>
  if (!pr)
    return <p className="p-6 text-fg-muted">{t('github.loadingPR', { number: params.number })}</p>

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl p-6">
        <h1 className="text-lg text-fg select-text">
          {pr.title} <span className="text-fg-muted">#{pr.number}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-fg-muted">
          <span className="rounded-full bg-surface-3 px-2 text-[11px] text-fg">
            {pr.draft ? t('github.draft') : t(`github.state.${pr.state}`)}
          </span>
          {pr.author} {t('github.wantsToMerge')} <code className="text-fg">{pr.headRef}</code>{' '}
          {t('github.into')} <code className="text-fg">{pr.baseRef}</code>
          {pr.fromFork && <span className="text-[11px]">(fork)</span>}
        </p>
        <p className="mt-1 text-[11px] text-fg-muted">
          {t('github.files', { n: pr.changedFiles })} ·{' '}
          <span className="text-success">+{pr.additions}</span>{' '}
          <span className="text-danger">−{pr.deletions}</span>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void checkoutPull(pr.number).finally(() => setBusy(false))
            }}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-accent-fg hover:bg-accent/85 disabled:opacity-50"
          >
            <FolderGit2 size={14} /> {busy ? t('github.preparing') : t('github.openInWorktree')}
          </button>
          <button
            type="button"
            onClick={() => window.open(pr.url, '_blank')}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 hover:bg-surface-2"
          >
            <ExternalLink size={14} /> {t('github.openOnGitHub')}
          </button>
        </div>

        <section className="mt-6" aria-label="Checks">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
            <CheckIcon state={pr.checks.state} /> Checks
            <button
              type="button"
              aria-label={t('github.refreshChecks')}
              onClick={() => void load()}
              className="hover:text-fg"
            >
              <RefreshCw size={12} />
            </button>
          </h2>
          {pr.checks.runs.length === 0 ? (
            <p className="text-fg-muted">{t('github.noChecks')}</p>
          ) : (
            <ul className="rounded-md border border-border">
              {pr.checks.runs.map((run, i) => (
                <li
                  key={`${run.name}-${i}`}
                  className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-0"
                >
                  <CheckIcon state={runState(run)} />
                  <span className="flex-1 truncate">{run.name}</span>
                  <span className="text-[11px] text-fg-muted">{run.conclusion ?? run.status}</span>
                  {run.url && (
                    <button
                      type="button"
                      aria-label={t('github.openRun', { name: run.name })}
                      onClick={() => window.open(run.url ?? '', '_blank')}
                      className="text-fg-muted hover:text-fg"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6" aria-label={t('github.description')}>
          <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
            {t('github.description')}
          </h2>
          <div className="rounded-md border border-border bg-surface-1 p-4 whitespace-pre-wrap text-fg select-text">
            {pr.body.trim() || <span className="text-fg-muted">{t('github.noDescription')}</span>}
          </div>
        </section>
      </article>
    </div>
  )
}
