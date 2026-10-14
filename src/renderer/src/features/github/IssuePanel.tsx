import type { IDockviewPanelProps } from 'dockview-react'
import type { IssueDetail } from '@shared/types'
import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspace.store'

export function IssuePanel({ params }: IDockviewPanelProps<{ number: number }>) {
  const root = useWorkspaceStore((s) => s.root)
  const [issue, setIssue] = useState<IssueDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (root) {
      void window.api.github.getIssue(root, params.number).then((res) => {
        if (!alive) return
        if (res.ok) setIssue(res.data)
        else setError(res.error.message)
      })
    }
    return () => {
      alive = false
    }
  }, [root, params.number])

  if (error) return <p className="p-6 text-danger">{error}</p>
  if (!issue) return <p className="p-6 text-fg-muted">Carregando issue #{params.number}…</p>

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl p-6">
        <h1 className="text-lg text-fg select-text">
          {issue.title} <span className="text-fg-muted">#{issue.number}</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-fg-muted">
          <span className="rounded-full bg-surface-3 px-2 text-[11px] text-fg">
            {issue.state === 'open' ? 'Aberta' : 'Fechada'}
          </span>
          aberta por {issue.author ?? '?'} · {issue.comments} comentário(s)
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
          <ExternalLink size={14} /> Abrir no GitHub
        </button>
        <div className="mt-6 rounded-md border border-border bg-surface-1 p-4 whitespace-pre-wrap text-fg select-text">
          {issue.body.trim() || <span className="text-fg-muted">Sem descrição.</span>}
        </div>
      </article>
    </div>
  )
}
