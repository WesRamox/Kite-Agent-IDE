import { createPortal } from 'react-dom'
import type { DeliverResult, Task, TaskReview } from '@shared/types'
import { useEffect, useState } from 'react'
import { deliverTask } from './review.actions'
import { t, useT } from '../../lib/i18n'

// Commit em lote e PRs da tarefa (Fase 9). Fora do canvas: segue o estilo dos diálogos do app.

const INPUT =
  'rounded-md border border-border bg-surface-0 px-2.5 text-[13px] text-fg placeholder:text-fg-muted/60 focus:border-fg-muted/50 focus:outline-none'
const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'

function defaultBody(task: Task): string {
  const lines = [
    t('deliver.bodyTask', {
      task: task.key === task.name ? task.key : `${task.key} · ${task.name}`,
    }),
  ]
  return lines.join('\n')
}

export function DeliverDialog(props: {
  task: Task
  review: TaskReview
  initial: string[]
  openPRs: boolean
  onClose: () => void
}) {
  const { task, review } = props
  const [chosen, setChosen] = useState<Set<string>>(new Set(props.initial))
  const tr = useT()
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState(
    task.key === task.name ? task.name : `${task.key} ${task.name}`,
  )
  const [body, setBody] = useState(defaultBody(task))
  const [draft, setDraft] = useState(false)
  const [bases, setBases] = useState<Record<string, string>>(
    Object.fromEntries(review.repos.map((r) => [r.worktree, r.base])),
  )
  const [busy, setBusy] = useState(false)
  // Esc fecha (menos durante o commit/push).
  const { onClose } = props
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  const [results, setResults] = useState<DeliverResult[] | null>(null)

  const selected = review.repos.filter((r) => chosen.has(r.worktree))
  const needsMessage = selected.some((r) => r.uncommitted > 0)
  const canSubmit = (openPRs: boolean) =>
    !busy &&
    selected.length > 0 &&
    (!needsMessage || message.trim() !== '') &&
    (!openPRs || title.trim() !== '')

  const submit = async (openPRs: boolean) => {
    if (!canSubmit(openPRs)) return
    setBusy(true)
    const res = await deliverTask(task, {
      worktrees: selected.map((r) => r.worktree),
      message,
      openPRs,
      title,
      body,
      draft,
      bases: Object.fromEntries(selected.map((r) => [r.worktree, bases[r.worktree] ?? r.base])),
    })
    setBusy(false)
    if (res) setResults(res)
  }

  // No body: dentro do painel do dockview, `fixed` ficaria preso ao painel (transform).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/30 pt-[10vh]"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && props.onClose()}
    >
      <div
        role="dialog"
        aria-label={props.openPRs ? tr('deliver.labelPRs') : tr('deliver.labelCommit')}
        className="flex h-fit max-h-[80vh] w-[620px] flex-col gap-4 overflow-y-auto rounded-[10px] border border-border bg-surface-1 p-5 font-geist text-[13px] text-fg shadow-2xl"
      >
        <h2 className="text-base font-semibold">
          {props.openPRs
            ? tr('deliver.titlePRs', { name: task.name })
            : tr('deliver.titleCommit', { name: task.name })}
        </h2>

        {results ? (
          <>
            <ul aria-label={tr('deliver.result')} className="flex flex-col gap-2">
              {results.map((r) => (
                <li
                  key={r.worktree}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-0 px-3 py-2"
                >
                  <span className="font-geist-mono font-medium">{r.repoName}</span>
                  {r.committed && (
                    <span className="text-xs text-success">{tr('deliver.committed')}</span>
                  )}
                  {r.pr && (
                    <a
                      href={r.pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent"
                    >
                      {r.pr.created
                        ? tr('deliver.prOpened', { number: r.pr.number })
                        : tr('deliver.prUpdated', { number: r.pr.number })}
                    </a>
                  )}
                  {r.error && <span className="w-full text-xs text-danger">{r.error}</span>}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={props.onClose}
                className="h-8 rounded-[7px] bg-accent px-3.5 font-semibold text-accent-fg hover:bg-accent/85"
              >
                {tr('deliver.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className={`mb-2 ${LABEL}`}>{tr('deliver.repos')}</legend>
              {review.repos.map((r) => (
                <label key={r.worktree} className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={chosen.has(r.worktree)}
                    disabled={r.files.length === 0 && r.ahead === 0}
                    onChange={() =>
                      setChosen((c) => {
                        const next = new Set(c)
                        if (next.has(r.worktree)) next.delete(r.worktree)
                        else next.add(r.worktree)
                        return next
                      })
                    }
                    className="size-4 accent-accent"
                  />
                  <span className="w-20 font-geist-mono font-medium">{r.repoName}</span>
                  <span className="flex-1 text-xs text-fg-muted">
                    {tr('deliver.repoState', { uncommitted: r.uncommitted, ahead: r.ahead })}
                    {r.pr
                      ? tr('deliver.prState', {
                          number: r.pr.number,
                          state: tr(`details.pr.${r.pr.state}`),
                        })
                      : ''}
                  </span>
                  {props.openPRs && !(r.pr?.state === 'open') && (
                    <input
                      aria-label={tr('deliver.base', { repo: r.repoName })}
                      value={bases[r.worktree] ?? ''}
                      onChange={(e) => setBases((b) => ({ ...b, [r.worktree]: e.target.value }))}
                      className={`h-7 w-28 font-geist-mono text-xs ${INPUT}`}
                    />
                  )}
                </label>
              ))}
            </fieldset>

            {needsMessage && (
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>{tr('deliver.message')}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="feat: …"
                  className={`resize-y py-2 ${INPUT}`}
                />
              </label>
            )}

            {props.openPRs && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>{tr('deliver.prTitle')}</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`h-8 ${INPUT}`}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>{tr('deliver.description')}</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    className={`resize-y py-2 ${INPUT}`}
                  />
                  <span className="text-xs text-fg-muted">{tr('deliver.crossLinks')}</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft}
                    onChange={(e) => setDraft(e.target.checked)}
                    className="accent-accent"
                  />
                  {tr('deliver.draft')}
                </label>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={props.onClose}
                className="h-8 rounded-[7px] px-3 text-fg-muted hover:text-fg"
              >
                {tr('common.cancel')}
              </button>
              {props.openPRs && (
                <button
                  type="button"
                  disabled={!needsMessage || !canSubmit(false)}
                  onClick={() => void submit(false)}
                  className="h-8 rounded-[7px] border border-border bg-surface-2 px-3 text-fg hover:bg-surface-3 disabled:opacity-50"
                >
                  {tr('deliver.commitOnly')}
                </button>
              )}
              <button
                type="button"
                disabled={!canSubmit(props.openPRs)}
                onClick={() => void submit(props.openPRs)}
                className="h-8 rounded-[7px] bg-accent px-3.5 font-semibold text-accent-fg hover:bg-accent/85 disabled:opacity-50"
              >
                {busy
                  ? tr('deliver.sending')
                  : props.openPRs
                    ? tr('deliver.commitAndPRs')
                    : tr('deliver.commit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
