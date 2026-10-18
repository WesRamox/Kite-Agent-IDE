import { GitPullRequest, GitPullRequestDraft, LogOut, Plus, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useGitStore } from '../git/git.store'
import {
  loadAuth,
  loadList,
  loadRepo,
  logout,
  openCreatePull,
  openIssue,
  openPull,
} from './github.actions'
import { useGitHubStore, type GitHubTab } from './github.store'
import { LoginBox } from './LoginBox'
import { RepoPicker } from '../git/RepoPicker'
import { t as tr, useT } from '../../lib/i18n'

const FILTERS = ['open', 'closed', 'all'] as const

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (!Number.isFinite(min)) return ''
  if (min < 60) return tr('agents.elapsed.min', { n: Math.max(min, 1) })
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h`
  return `${Math.round(h / 24)} d`
}

export function GitHubPanel() {
  const root = useGitStore((s) => s.root)
  const auth = useGitHubStore((s) => s.auth)

  useEffect(() => {
    void loadAuth()
  }, [])

  // Espera o painel Git liberar e ler o repositório escolhido (segue a tarefa aberta).
  const ready = useGitStore((s) => s.status !== null)
  const loggedIn = !!auth?.user
  const t = useT()
  useEffect(() => {
    if (loggedIn && ready) void loadRepo()
  }, [root, loggedIn, ready])

  if (!auth) return <p className="px-4 py-6 text-center text-fg-muted">{t('common.loading')}</p>
  if (!auth.configured) {
    return (
      <div className="px-4 py-6 text-fg-muted">
        <p>{t('github.notConfigured')}</p>
        <p className="mt-2">{t('github.notConfiguredHint')}</p>
      </div>
    )
  }
  if (!auth.user) return <LoginBox />
  return <Connected />
}

function Connected() {
  const auth = useGitHubStore((s) => s.auth)
  const root = useGitStore((s) => s.root)
  const repo = useGitHubStore((s) => s.repo)
  const repoError = useGitHubStore((s) => s.repoError)
  const tab = useGitHubStore((s) => s.tab)
  const set = useGitHubStore((s) => s.set)
  const filter = useGitHubStore((s) => s.filter)
  const user = auth?.user
  const t = useT()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pb-2">
        {user?.avatarUrl && <img src={user.avatarUrl} alt="" className="size-5 rounded-full" />}
        <span className="flex-1 truncate">{user?.login}</span>
        <button
          type="button"
          title={t('github.signOut')}
          aria-label={t('github.signOutLabel')}
          onClick={() => void logout()}
          className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <LogOut size={14} />
        </button>
      </div>

      <RepoPicker />
      {!root && <p className="px-4 py-4 text-center text-fg-muted">{t('github.openFolder')}</p>}
      {root && repo === undefined && !repoError && (
        <p className="px-4 py-4 text-center text-fg-muted">{t('common.loading')}</p>
      )}
      {root && repo === null && (
        <p className="px-4 py-4 text-center text-fg-muted">{repoError ?? t('github.notGitHub')}</p>
      )}

      {repo && (
        <>
          <button
            type="button"
            title={t('github.openOnGitHub')}
            onClick={() => window.open(repo.url, '_blank')}
            className="mx-3 truncate text-left text-[11px] text-accent hover:underline"
          >
            {repo.owner}/{repo.repo}
          </button>
          <div
            className="mt-2 flex items-center gap-1 border-b border-border px-3 pb-1"
            role="tablist"
          >
            {(['prs', 'issues'] as GitHubTab[]).map((tabId) => (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={tab === tabId}
                onClick={() => {
                  set({ tab: tabId })
                  void loadList()
                }}
                className={`rounded px-2 py-0.5 ${tab === tabId ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'}`}
              >
                {tabId === 'prs' ? t('github.prs') : t('github.issues')}
              </button>
            ))}
            <select
              aria-label={t('github.filter')}
              value={filter}
              onChange={(e) => {
                set({ filter: e.target.value as typeof filter })
                void loadList()
              }}
              className="ml-auto rounded border border-border bg-surface-0 px-1 py-0.5 text-[11px] text-fg"
            >
              {FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`github.filter.${value}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              title={t('github.refresh')}
              aria-label={t('github.refreshList')}
              onClick={() => void loadList()}
              className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg"
            >
              <RefreshCw size={12} />
            </button>
          </div>
          {tab === 'prs' && (
            <button
              type="button"
              onClick={openCreatePull}
              className="mx-3 mt-2 flex items-center justify-center gap-1 rounded-md border border-border py-1 hover:bg-surface-2"
            >
              <Plus size={14} /> {t('github.createPR')}
            </button>
          )}
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto pb-4">
            {tab === 'prs' ? <PullList /> : <IssueList />}
          </div>
        </>
      )}
    </div>
  )
}

function ListState({ empty }: { empty: string }) {
  const error = useGitHubStore((s) => s.listError)
  return (
    <p className={`px-4 py-4 text-center ${error ? 'text-danger' : 'text-fg-muted'}`}>
      {error ?? empty}
    </p>
  )
}

function PullList() {
  const prs = useGitHubStore((s) => s.prs)
  const error = useGitHubStore((s) => s.listError)
  if (error) return <ListState empty="" />
  if (!prs) return <ListState empty={tr('common.loading')} />
  if (prs.length === 0) return <ListState empty={tr('github.noPRs')} />
  return (
    <ul aria-label="Pull requests">
      {prs.map((p) => {
        const Icon = p.draft ? GitPullRequestDraft : GitPullRequest
        const color =
          p.state === 'merged'
            ? 'text-merged'
            : p.state === 'closed'
              ? 'text-danger'
              : p.draft
                ? 'text-fg-muted'
                : 'text-success'
        return (
          <li key={p.number}>
            <button
              type="button"
              onClick={() => openPull(p.number, p.title)}
              className="flex w-full gap-2 px-3 py-1.5 text-left hover:bg-surface-2"
            >
              <Icon size={14} className={`mt-0.5 shrink-0 ${color}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-fg">{p.title}</span>
                <span className="block truncate text-[11px] text-fg-muted">
                  #{p.number} · {p.author ?? '?'} · {p.headRef} → {p.baseRef} ·{' '}
                  {relativeTime(p.updatedAt)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function IssueList() {
  const issues = useGitHubStore((s) => s.issues)
  const error = useGitHubStore((s) => s.listError)
  if (error) return <ListState empty="" />
  if (!issues) return <ListState empty={tr('common.loading')} />
  if (issues.length === 0) return <ListState empty={tr('github.noIssues')} />
  return (
    <ul aria-label="Issues">
      {issues.map((i) => (
        <li key={i.number}>
          <button
            type="button"
            onClick={() => openIssue(i.number, i.title)}
            className="flex w-full gap-2 px-3 py-1.5 text-left hover:bg-surface-2"
          >
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${i.state === 'open' ? 'bg-success' : 'bg-merged'}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-fg">{i.title}</span>
              <span className="flex flex-wrap items-center gap-1 text-[11px] text-fg-muted">
                #{i.number} · {i.author ?? '?'} · {relativeTime(i.updatedAt)}
                {i.labels.map((l) => (
                  <span
                    key={l.name}
                    className="rounded-full border px-1.5"
                    style={{ borderColor: `#${l.color}` }}
                  >
                    {l.name}
                  </span>
                ))}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
