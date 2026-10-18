import { DiffEditor } from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { basename } from '../../lib/paths'
import { detectLanguage } from '../../lib/language'
import { monaco, useMonacoTheme } from '../editor/use-monaco'
import { FileIcon } from '../../components/FileIcon'
import { KIND_COLOR, KIND_LETTER } from '../../lib/git-format'
import { useAgentsStore } from './agents.store'
import { useAgentReview, useAgentReviewDiff, type ReviewParams } from './use-agent-review'
import { useSessionsStore } from './sessions.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useT } from '../../lib/i18n'

export function ReviewPanel({ api, params }: IDockviewPanelProps<ReviewParams>) {
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const monacoTheme = useMonacoTheme()
  const t = useT()
  const task = useAgentsStore((s) => s.tasks.find((t) => t.id === params.taskId))
  const sessionStatus = useSessionsStore(
    (s) => s.sessions.find((x) => x.id === params.sessionId)?.status,
  )
  const [selected, setSelected] = useState<string | null>(null)

  // Recarrega quando o status do agente muda (ele pode ter mexido em arquivos).
  const status = task?.status ?? sessionStatus
  const {
    data: review,
    error,
    reload,
  } = useAgentReview(params, {
    refresh: status,
    onData: (data) =>
      setSelected((cur) =>
        cur && data.files.some((f) => f.path === cur) ? cur : (data.files[0]?.path ?? null),
      ),
  })
  const fileDiff = useAgentReviewDiff(params, selected, review)
  // Diff com erro não aparece (como antes): só o da resposta boa mais recente.
  const diff = fileDiff.error ? null : fileDiff.data

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border px-3 text-[11px] text-fg-muted">
        <span className="truncate">
          {params.sessionId !== undefined ? (
            t('agentReview.uncommitted')
          ) : task ? (
            <>
              <code className="text-fg">{task.branch}</code> {t('agentReview.comparedWith')}{' '}
              <code className="text-fg">{review?.base ?? task.baseBranch}</code>
            </>
          ) : (
            t('agentReview.removed')
          )}
        </span>
        <button
          type="button"
          onClick={reload}
          className="ml-auto flex items-center gap-1 hover:text-fg"
          aria-label={t('agentReview.refresh')}
        >
          <RefreshCw size={12} /> {t('agentReview.refreshShort')}
        </button>
      </div>
      {error && <p className="p-4 text-danger">{error}</p>}
      {!error && review && review.files.length === 0 && (
        <p className="p-4 text-fg-muted">
          {params.sessionId !== undefined ? t('agentReview.sessionEmpty') : t('agentReview.empty')}
        </p>
      )}
      {!error && review && review.files.length > 0 && (
        <div className="flex min-h-0 flex-1">
          <ul
            aria-label={t('agentReview.files')}
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
            {diff?.binary && <p className="p-4 text-fg-muted">{t('agentReview.binary')}</p>}
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
                  fontSize,
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
