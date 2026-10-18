import { DiffEditor } from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { GitDiff } from '@shared/types'
import { FileText } from 'lucide-react'
import { basename } from '../../lib/paths'
import { openFile } from '../editor/editor.actions'
import { detectLanguage } from '../../lib/language'
import { monaco, useMonacoTheme } from '../editor/use-monaco'
import type { DiffParams } from './git.actions'
import { useGitDiff } from './use-git-diff'
import { CODE_FONT } from '../../lib/code-font'
import { useSettingsStore } from '../../stores/settings.store'
import { useT } from '../../lib/i18n'

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; diff: GitDiff }

export function DiffPanel({ api, params }: IDockviewPanelProps<DiffParams>) {
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const monacoTheme = useMonacoTheme()
  const t = useT()
  const { path, staged } = params
  const diff = useGitDiff(path, staged)
  const state: State = diff.error
    ? { kind: 'error', message: diff.error }
    : diff.data
      ? { kind: 'ready', diff: diff.data }
      : { kind: 'loading' }

  const language = detectLanguage(basename(path), monaco.languages.getLanguages())

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-border px-3 text-[11px] text-fg-muted">
        <span className="truncate">
          {staged ? t('git.diffStaged') : t('git.diffWorking')} · {path}
        </span>
        <button
          type="button"
          onClick={() => void openFile(path)}
          className="ml-auto flex items-center gap-1 hover:text-fg"
        >
          <FileText size={12} /> {t('quickOpen.label')}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {state.kind === 'loading' && <p className="p-4 text-fg-muted">{t('git.loadingDiff')}</p>}
        {state.kind === 'error' && <p className="p-4 text-danger">{state.message}</p>}
        {state.kind === 'ready' && state.diff.binary && (
          <p className="p-4 text-fg-muted">{t('git.binary')}</p>
        )}
        {state.kind === 'ready' && !state.diff.binary && (
          <DiffEditor
            className="min-w-0 overflow-hidden"
            original={state.diff.original}
            modified={state.diff.modified}
            language={language}
            theme={monacoTheme}
            originalModelPath={`inmemory://diff/${encodeURIComponent(api.id)}/original`}
            modifiedModelPath={`inmemory://diff/${encodeURIComponent(api.id)}/modified`}
            options={{
              readOnly: true,
              originalEditable: false,
              automaticLayout: true,
              renderSideBySide: true,
              fontSize,
              fontFamily: CODE_FONT,
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
            }}
          />
        )}
      </div>
    </div>
  )
}
