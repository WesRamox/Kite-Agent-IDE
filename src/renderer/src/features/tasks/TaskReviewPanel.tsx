import { DiffEditor } from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { GitChangeKind, GitDiff, ReviewFile, ReviewRepo, TaskReview } from '@shared/types'
import { useEffect, useState } from 'react'
import { CODE_FONT } from '../../lib/code-font'
import { basename } from '../../lib/paths'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useAttentionItems } from '../agents/use-attention'
import { detectLanguage } from '../../lib/language'
import { monaco, useMonacoTheme } from '../editor/use-monaco'
import { AskAgentDialog } from './AskAgentDialog'
import { DeliverDialog } from './DeliverDialog'
import { useDeliverRequest, type TaskReviewParams } from './review.actions'
import { toast } from '../../stores/toast.store'
import { useTasksStore } from './tasks.store'
import { useSettingsStore } from '../../stores/settings.store'
import { t, useT } from '../../lib/i18n'

// Tela 3 do canvas "Kite — Tarefas multi-repo" (Review.dc.html).

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

const SMALL_BTN =
  'h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3'

function delta(f: ReviewFile): string {
  if (f.added === null || f.deleted === null) return '—'
  if (f.deleted === 0) return `+${f.added}`
  if (f.added === 0) return `−${f.deleted}`
  return `+${f.added} −${f.deleted}`
}

interface Selected {
  worktree: string
  rel: string
}

type DialogState = { kind: 'deliver'; repos: string[]; openPRs: boolean } | { kind: 'ask' } | null

export function TaskReviewPanel({ params }: IDockviewPanelProps<TaskReviewParams>) {
  const root = useWorkspaceStore((s) => s.root)
  const task = useTasksStore((s) => s.workspace?.tasks.find((t) => t.id === params.taskId) ?? null)
  // Recarrega quando o status git de alguma worktree da tarefa muda (salvar, commitar...).
  const statusKey = useTasksStore((s) =>
    (task?.worktrees ?? [])
      .map((w) => {
        const st = s.status[w.path]
        return st?.isRepo ? `${st.files.length}:${st.ahead}:${st.head}` : ''
      })
      .join('|'),
  )
  const waiting = useAttentionItems().some(
    (x) => x.wsTask?.id === params.taskId && x.group === 'waiting',
  )
  const [review, setReview] = useState<TaskReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  // Recarregar à mão (depois de commitar) incrementa o contador.
  const [reloads, setReloads] = useState(0)
  const tr = useT()
  const reload = () => setReloads((n) => n + 1)

  // Pedido de entrega (barra da tarefa): recarrega e abre o diálogo com o que dá para entregar.
  const deliverRequested = useDeliverRequest((s) => s.taskId === params.taskId)

  useEffect(() => {
    if (!root) return
    let alive = true
    void window.api.review.task(root, params.taskId, {}).then((res) => {
      if (!alive) return
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      setError(null)
      setReview(res.data)
      if (useDeliverRequest.getState().taskId === params.taskId) {
        useDeliverRequest.setState({ taskId: null })
        const ready = res.data.repos.filter((r) => r.files.length > 0 || r.ahead > 0)
        if (ready.length === 0) toast.info(t('review.nothingToDeliver'))
        else setDialog({ kind: 'deliver', repos: ready.map((r) => r.worktree), openPRs: true })
      }
      setSelected((cur) => {
        const still =
          cur &&
          res.data.repos.some(
            (r) => r.worktree === cur.worktree && r.files.some((f) => f.rel === cur.rel),
          )
        if (still) return cur
        const first = res.data.repos.find((r) => r.files.length > 0)
        return first?.files[0] ? { worktree: first.worktree, rel: first.files[0].rel } : null
      })
    })
    return () => {
      alive = false
    }
  }, [root, params.taskId, statusKey, reloads, deliverRequested])

  if (!task) return <p className="p-6 text-fg-muted">{tr('review.notFound')}</p>
  const repos = review?.repos ?? []
  const totalFiles = repos.reduce((n, r) => n + r.files.length, 0)
  const added = repos.reduce((n, r) => n + r.added, 0)
  const deleted = repos.reduce((n, r) => n + r.deleted, 0)
  const deliverable = repos.filter((r) => r.files.length > 0 || r.ahead > 0)
  const selectedRepo = repos.find((r) => r.worktree === selected?.worktree) ?? null

  return (
    <div className="flex h-full flex-col bg-surface-0 font-geist text-[13px] text-fg">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-1 px-6 py-4">
        {task.key !== task.name && (
          <span className="font-geist-mono text-xs text-fg-muted">{task.key}</span>
        )}
        <h1 className="text-lg font-semibold">{tr('review.title', { name: task.name })}</h1>
        {waiting && (
          <span className="inline-flex h-[22px] items-center rounded-full bg-accent/15 px-2 text-xs text-accent">
            {tr('review.agentWaiting')}
          </span>
        )}
        <span className="flex-1" />
        <span className="text-xs text-fg-muted">
          {tr('review.summary', { repos: repos.length, files: totalFiles })} · +{added} −{deleted}
        </span>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'ask' })}
          className="h-8 rounded-[7px] border border-border bg-surface-2 px-3 text-fg hover:bg-surface-3"
        >
          {tr('review.ask')}
        </button>
        <button
          type="button"
          disabled={deliverable.length === 0}
          onClick={() =>
            setDialog({ kind: 'deliver', repos: deliverable.map((r) => r.worktree), openPRs: true })
          }
          className="h-8 rounded-[7px] bg-accent px-3.5 font-semibold text-accent-fg hover:bg-accent/85 disabled:opacity-50"
        >
          {tr('review.deliver', { n: deliverable.length })}
        </button>
      </header>
      {error && <p className="px-6 py-3 text-danger">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label={tr('review.files')}
          className="w-[340px] shrink-0 overflow-y-auto border-r border-border bg-surface-1 px-1.5 py-2.5"
        >
          {review === null && !error && (
            <p className="px-3 text-fg-muted">{tr('common.loading')}</p>
          )}
          {repos.map((r) => (
            <RepoGroup
              key={r.worktree}
              repo={r}
              selected={selected}
              onSelect={(rel) => setSelected({ worktree: r.worktree, rel })}
              onCommit={() => setDialog({ kind: 'deliver', repos: [r.worktree], openPRs: false })}
              onPR={() => setDialog({ kind: 'deliver', repos: [r.worktree], openPRs: true })}
            />
          ))}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          {selected && selectedRepo ? (
            <FileDiff
              key={`${selected.worktree}:${selected.rel}`}
              repo={selectedRepo}
              rel={selected.rel}
              taskId={task.id}
            />
          ) : (
            <p className="p-6 text-fg-muted">{review ? tr('review.nothing') : ''}</p>
          )}
        </main>
      </div>
      {dialog?.kind === 'deliver' && review && (
        <DeliverDialog
          task={task}
          review={review}
          initial={dialog.repos}
          openPRs={dialog.openPRs}
          onClose={() => {
            setDialog(null)
            reload()
          }}
        />
      )}
      {dialog?.kind === 'ask' && <AskAgentDialog task={task} onClose={() => setDialog(null)} />}
    </div>
  )
}

function RepoGroup(props: {
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

type DiffState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; diff: GitDiff }

function FileDiff({ repo, rel, taskId }: { repo: ReviewRepo; rel: string; taskId: string }) {
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const root = useWorkspaceStore((s) => s.root)
  const monacoTheme = useMonacoTheme()
  const [state, setState] = useState<DiffState>({ kind: 'loading' })
  const [sideBySide, setSideBySide] = useState(false)
  const tr = useT()

  useEffect(() => {
    if (!root) return
    let alive = true
    void window.api.review.diff(root, taskId, repo.worktree, repo.base, rel).then((res) => {
      if (!alive) return
      setState(
        res.ok ? { kind: 'ready', diff: res.data } : { kind: 'error', message: res.error.message },
      )
    })
    return () => {
      alive = false
    }
  }, [root, taskId, repo.worktree, repo.base, rel])

  const language = detectLanguage(basename(rel), monaco.languages.getLanguages())
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5 text-xs">
        <span className="rounded bg-surface-3 px-[5px] py-px font-geist-mono text-[10px] text-fg-muted">
          {repo.repoName}
        </span>
        <span className="truncate font-geist-mono">{rel}</span>
        <span className="text-fg-muted">
          {repo.base} → {repo.branch ?? 'HEAD'}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-pressed={sideBySide}
          onClick={() => setSideBySide((v) => !v)}
          className={SMALL_BTN}
        >
          {sideBySide ? tr('review.inline') : tr('review.sideBySide')}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {state.kind === 'loading' && (
          <p className="p-4 text-fg-muted">{tr('review.loadingDiff')}</p>
        )}
        {state.kind === 'error' && <p className="p-4 text-danger">{state.message}</p>}
        {state.kind === 'ready' && state.diff.binary && (
          <p className="p-4 text-fg-muted">{tr('review.binary')}</p>
        )}
        {state.kind === 'ready' && !state.diff.binary && (
          <DiffEditor
            className="min-w-0 overflow-hidden"
            original={state.diff.original}
            modified={state.diff.modified}
            language={language}
            theme={monacoTheme}
            originalModelPath={`inmemory://task-review/${encodeURIComponent(repo.worktree)}/${encodeURIComponent(rel)}/original`}
            modifiedModelPath={`inmemory://task-review/${encodeURIComponent(repo.worktree)}/${encodeURIComponent(rel)}/modified`}
            options={{
              readOnly: true,
              originalEditable: false,
              automaticLayout: true,
              renderSideBySide: sideBySide,
              fontSize,
              fontFamily: CODE_FONT,
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
            }}
          />
        )}
      </div>
    </>
  )
}
