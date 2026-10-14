import { DiffEditor } from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { AgentReview, GitDiff } from '@shared/types'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { basename } from '../../lib/paths'
import { detectLanguage } from '../editor/language'
import { monaco, useMonacoTheme } from '../editor/monaco-setup'
import { FileIcon } from '../explorer/FileIcon'
import { KIND_COLOR, KIND_LETTER } from '../git/git-format'
import { useAgentsStore } from './agents.store'

// Revisão de uma tarefa: o que mudou na worktree do agente desde a branch de origem.
export function ReviewPanel({ api, params }: IDockviewPanelProps<{ taskId: string }>) {
  const monacoTheme = useMonacoTheme()
  const task = useAgentsStore((s) => s.tasks.find((t) => t.id === params.taskId))
  const [review, setReview] = useState<AgentReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [diff, setDiff] = useState<GitDiff | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.agent.review(params.taskId)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setError(null)
    setReview(res.data)
    setSelected((cur) =>
      cur && res.data.files.some((f) => f.path === cur) ? cur : (res.data.files[0]?.path ?? null),
    )
  }, [params.taskId])

  // Recarrega quando o status do agente muda (ele pode ter mexido em arquivos).
  const status = task?.status
  useEffect(() => {
    let alive = true
    void window.api.agent.review(params.taskId).then((res) => {
      if (!alive) return
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      setReview(res.data)
      setSelected((cur) =>
        cur && res.data.files.some((f) => f.path === cur) ? cur : (res.data.files[0]?.path ?? null),
      )
    })
    return () => {
      alive = false
    }
  }, [params.taskId, status])

  useEffect(() => {
    let alive = true
    if (selected) {
      void window.api.agent.reviewDiff(params.taskId, selected).then((res) => {
        if (alive) setDiff(res.ok ? res.data : null)
      })
    }
    return () => {
      alive = false
    }
  }, [params.taskId, selected, review])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border px-3 text-[11px] text-fg-muted">
        <span className="truncate">
          {task ? (
            <>
              <code className="text-fg">{task.branch}</code> comparado com{' '}
              <code className="text-fg">{review?.base ?? task.baseBranch}</code>
            </>
          ) : (
            'Tarefa removida'
          )}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto flex items-center gap-1 hover:text-fg"
          aria-label="Atualizar revisão"
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>
      {error && <p className="p-4 text-danger">{error}</p>}
      {!error && review && review.files.length === 0 && (
        <p className="p-4 text-fg-muted">O agente ainda não alterou nenhum arquivo.</p>
      )}
      {!error && review && review.files.length > 0 && (
        <div className="flex min-h-0 flex-1">
          <ul
            aria-label="Arquivos alterados"
            className="w-60 shrink-0 overflow-y-auto border-r border-border py-1"
          >
            {review.files.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  title={f.path}
                  onClick={() => setSelected(f.path)}
                  className={`flex w-full items-center gap-1.5 px-3 py-0.5 text-left ${
                    selected === f.path ? 'bg-accent/25' : 'hover:bg-surface-2'
                  }`}
                >
                  <FileIcon name={basename(f.path)} kind="file" />
                  <span className="min-w-0 flex-1 truncate">{f.path}</span>
                  <span className={`font-mono text-[11px] ${KIND_COLOR[f.status]}`}>
                    {KIND_LETTER[f.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1">
            {diff?.binary && (
              <p className="p-4 text-fg-muted">Arquivo binário: diff não disponível.</p>
            )}
            {diff && !diff.binary && selected && (
              <DiffEditor
                className="min-w-0 overflow-hidden"
                original={diff.original}
                modified={diff.modified}
                language={detectLanguage(basename(selected), monaco.languages.getLanguages())}
                theme={monacoTheme}
                originalModelPath={`inmemory://review/${encodeURIComponent(api.id)}/original`}
                modifiedModelPath={`inmemory://review/${encodeURIComponent(api.id)}/modified`}
                options={{
                  readOnly: true,
                  originalEditable: false,
                  automaticLayout: true,
                  renderSideBySide: true,
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
