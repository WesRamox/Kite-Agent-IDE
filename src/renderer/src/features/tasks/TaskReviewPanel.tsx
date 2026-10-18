import type { IDockviewPanelProps } from 'dockview-react'
import { useState } from 'react'
import { t, useT } from '../../lib/i18n'
import { toast } from '../../stores/toast.store'
import { useAttentionItems } from '../agents/use-attention'
import { AskAgentDialog } from './AskAgentDialog'
import { DeliverDialog } from './DeliverDialog'
import { useDeliverRequest, type TaskReviewParams } from './review.actions'
import { FileDiff } from './ReviewFileDiff'
import { RepoGroup, type Selected } from './ReviewRepoGroup'
import { useTasksStore } from './tasks.store'
import { useTaskReview } from './use-task-review'

// Tela 3 do canvas "Kite — Tarefas multi-repo" (Review.dc.html).

type DialogState = { kind: 'deliver'; repos: string[]; openPRs: boolean } | { kind: 'ask' } | null

export function TaskReviewPanel({ params }: IDockviewPanelProps<TaskReviewParams>) {
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
  const [selected, setSelected] = useState<Selected | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const tr = useT()

  // Pedido de entrega (barra da tarefa): recarrega e abre o diálogo com o que dá para entregar.
  const deliverRequested = useDeliverRequest((s) => s.taskId === params.taskId)

  const {
    data: review,
    error,
    reload,
  } = useTaskReview(params.taskId, {
    refresh: `${statusKey}|${deliverRequested}`,
    onData: (data) => {
      if (useDeliverRequest.getState().taskId === params.taskId) {
        useDeliverRequest.setState({ taskId: null })
        const ready = data.repos.filter((r) => r.files.length > 0 || r.ahead > 0)
        if (ready.length === 0) toast.info(t('review.nothingToDeliver'))
        else setDialog({ kind: 'deliver', repos: ready.map((r) => r.worktree), openPRs: true })
      }
      setSelected((cur) => {
        const still =
          cur &&
          data.repos.some(
            (r) => r.worktree === cur.worktree && r.files.some((f) => f.rel === cur.rel),
          )
        if (still) return cur
        const first = data.repos.find((r) => r.files.length > 0)
        return first?.files[0] ? { worktree: first.worktree, rel: first.files[0].rel } : null
      })
    },
  })

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
