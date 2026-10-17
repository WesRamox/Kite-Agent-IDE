import { GitPullRequest } from 'lucide-react'
import { useState } from 'react'
import { useGitStore } from '../git/git.store'
import { createPull } from './github.actions'
import { useGitHubStore } from './github.store'
import { useT } from '../../lib/i18n'

export function CreatePullPanel() {
  const status = useGitStore((s) => s.status)
  const branches = useGitStore((s) => s.branches)
  const repo = useGitHubStore((s) => s.repo)
  const head = status?.isRepo ? status.branch : null
  const [title, setTitle] = useState(() => (head ? head.replace(/[-_/]+/g, ' ') : ''))
  const [body, setBody] = useState('')
  const [base, setBase] = useState(repo?.defaultBranch ?? 'main')
  const [draft, setDraft] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useT()

  if (!status?.isRepo) return <p className="p-6 text-fg-muted">{t('github.notRepo')}</p>
  if (!head) return <p className="p-6 text-fg-muted">{t('github.detached')}</p>
  if (!repo) return <p className="p-6 text-fg-muted">{t('github.signInForPR')}</p>

  const uncommitted = status.files.length > 0
  const sameAsBase = head === base
  const canSubmit = !busy && title.trim() !== '' && base.trim() !== '' && !sameAsBase

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    await createPull({ title: title.trim(), body, base: base.trim(), draft })
    setBusy(false)
  }

  return (
    <div className="h-full overflow-y-auto">
      <form
        className="mx-auto flex max-w-2xl flex-col gap-3 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h1 className="flex items-center gap-2 text-lg text-fg">
          <GitPullRequest size={18} /> {t('github.newPR')}
        </h1>
        <p className="text-fg-muted">
          {t('github.from')} <code className="text-fg">{head}</code> {t('github.to')}{' '}
          <code className="text-fg">
            {repo.owner}/{repo.repo}:{base}
          </code>
          . {t('github.pushNote')} <code>origin</code>.
        </p>
        {uncommitted && (
          <p className="rounded-md border border-warning/50 px-3 py-2 text-warning">
            {t('github.uncommitted', { n: status.files.length })}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">{t('github.title')}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">{t('github.description')}</span>
          <textarea
            value={body}
            rows={10}
            onChange={(e) => setBody(e.target.value)}
            className="resize-y rounded-md border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">{t('github.base')}</span>
          <input
            value={base}
            list="pr-base-branches"
            onChange={(e) => setBase(e.target.value)}
            className="rounded-md border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
          />
          <datalist id="pr-base-branches">
            {branches.map((b) => (
              <option key={b.name} value={b.name} />
            ))}
          </datalist>
          {sameAsBase && (
            <span className="text-[11px] text-danger">{t('github.baseMustDiffer')}</span>
          )}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          {t('github.createDraft')}
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="self-start rounded-md bg-accent px-4 py-1.5 text-accent-fg enabled:hover:bg-accent/85 disabled:opacity-40"
        >
          {busy ? t('github.sending') : t('github.createPullRequest')}
        </button>
      </form>
    </div>
  )
}
