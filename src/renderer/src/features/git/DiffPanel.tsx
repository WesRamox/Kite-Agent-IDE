import { DiffEditor } from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import type { GitDiff } from '@shared/types'
import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { basename } from '../../lib/paths'
import { openFile } from '../editor/editor.actions'
import { detectLanguage } from '../editor/language'
import { monaco, useMonacoTheme } from '../editor/monaco-setup'
import type { DiffParams } from './git.actions'
import { useGitStore } from './git.store'
import { CODE_FONT } from '../../lib/code-font'
import { useSettingsStore } from '../../stores/settings.store'

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; diff: GitDiff }

export function DiffPanel({ api, params }: IDockviewPanelProps<DiffParams>) {
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const monacoTheme = useMonacoTheme()
  const { path, staged } = params
  const root = useGitStore((s) => s.root)
  // Recarrega quando o status do git muda (novo stage, arquivo salvo, commit...).
  const status = useGitStore((s) => s.status)
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!root) return
    let alive = true
    void window.api.git.diff(root, path, staged).then((res) => {
      if (!alive) return
      setState(
        res.ok ? { kind: 'ready', diff: res.data } : { kind: 'error', message: res.error.message },
      )
    })
    return () => {
      alive = false
    }
  }, [root, path, staged, status])

  const language = detectLanguage(basename(path), monaco.languages.getLanguages())

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-border px-3 text-[11px] text-fg-muted">
        <span className="truncate">
          {staged ? 'HEAD ↔ stage' : 'stage ↔ arquivo no disco'} · {path}
        </span>
        <button
          type="button"
          onClick={() => void openFile(path)}
          className="ml-auto flex items-center gap-1 hover:text-fg"
        >
          <FileText size={12} /> Abrir arquivo
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {state.kind === 'loading' && <p className="p-4 text-fg-muted">Carregando diff…</p>}
        {state.kind === 'error' && <p className="p-4 text-danger">{state.message}</p>}
        {state.kind === 'ready' && state.diff.binary && (
          <p className="p-4 text-fg-muted">Arquivo binário: diff não disponível.</p>
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
