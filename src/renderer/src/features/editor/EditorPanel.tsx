import Editor from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useEffect, useRef } from 'react'
import { type EditorReveal, useEditorStore } from './editor.store'
import { uriFor } from './models'
import { type monaco, useMonacoTheme } from './use-monaco'
import { CODE_FONT } from '../../lib/code-font'
import { useSettingsStore } from '../../stores/settings.store'

const OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: CODE_FONT,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  fixedOverflowWidgets: true,
}

// Seleciona a ocorrência pedida e a traz para o meio da tela.
function applyReveal(editor: monaco.editor.IStandaloneCodeEditor, r: EditorReveal): void {
  editor.setSelection({
    startLineNumber: r.line,
    startColumn: r.column,
    endLineNumber: r.line,
    endColumn: r.column + r.length,
  })
  editor.revealLineInCenter(r.line)
  editor.focus()
  useEditorStore.getState().clearReveal(r.seq)
}

export function EditorPanel({ params, api }: IDockviewPanelProps<{ path: string }>) {
  const monacoTheme = useMonacoTheme()
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const { path } = params
  const reveal = useEditorStore((s) => (s.reveal?.path === path ? s.reveal : null))

  // Pedido para um editor já montado; o recém-aberto aplica no onMount.
  useEffect(() => {
    if (reveal && editorRef.current) applyReveal(editorRef.current, reveal)
  }, [reveal])

  // Cursor da aba ativa vai para a status bar.
  useEffect(() => {
    const sub = api.onDidActiveChange(({ isActive }) => {
      if (isActive) {
        editorRef.current?.focus()
        const pos = editorRef.current?.getPosition()
        if (pos) useEditorStore.getState().setCursor({ line: pos.lineNumber, column: pos.column })
      }
    })
    return () => sub.dispose()
  }, [api])

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        // min-w-0: sem isso o contêiner flex não encolhe e o Monaco não reage ao resize.
        className="min-w-0 overflow-hidden"
        // O modelo já foi criado em models.ts; o path faz o componente reutilizá-lo.
        path={uriFor(path).toString()}
        theme={monacoTheme}
        keepCurrentModel
        options={{ ...OPTIONS, fontSize }}
        onMount={(editor) => {
          editorRef.current = editor
          const pending = useEditorStore.getState().reveal
          if (pending?.path === path) applyReveal(editor, pending)
          if (api.isActive) {
            editor.focus()
            const pos = editor.getPosition()
            if (pos)
              useEditorStore.getState().setCursor({ line: pos.lineNumber, column: pos.column })
          }
          editor.onDidChangeCursorPosition(({ position }) => {
            if (useEditorStore.getState().activePath === path) {
              useEditorStore
                .getState()
                .setCursor({ line: position.lineNumber, column: position.column })
            }
          })
        }}
      />
    </div>
  )
}
