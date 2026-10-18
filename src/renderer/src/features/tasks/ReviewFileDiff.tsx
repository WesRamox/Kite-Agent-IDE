import { DiffEditor } from '@monaco-editor/react'
import type { GitDiff, ReviewRepo } from '@shared/types'
import { useState } from 'react'
import { CODE_FONT } from '../../lib/code-font'
import { useT } from '../../lib/i18n'
import { detectLanguage } from '../../lib/language'
import { basename } from '../../lib/paths'
import { useSettingsStore } from '../../stores/settings.store'
import { monaco, useMonacoTheme } from '../editor/use-monaco'
import { SMALL_BTN } from './review-ui'
import { useTaskReviewDiff } from './use-task-review'

type DiffState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; diff: GitDiff }

export function FileDiff({ repo, rel, taskId }: { repo: ReviewRepo; rel: string; taskId: string }) {
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const monacoTheme = useMonacoTheme()
  const diff = useTaskReviewDiff(taskId, repo, rel)
  const state: DiffState = diff.error
    ? { kind: 'error', message: diff.error }
    : diff.data
      ? { kind: 'ready', diff: diff.data }
      : { kind: 'loading' }
  const [sideBySide, setSideBySide] = useState(false)
  const tr = useT()

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
