import Editor from '@monaco-editor/react'
import type { IDockviewPanelProps } from 'dockview-react'
import { useEffect, useRef } from 'react'
import { useEditorStore } from './editor.store'
import { uriFor } from './models'
import { type monaco, useMonacoTheme } from './monaco-setup'
import { CODE_FONT } from '../../lib/code-font'

const OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: CODE_FONT,
  fontSize: 13,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  fixedOverflowWidgets: true,
}

export function EditorPanel({ params, api }: IDockviewPanelProps<{ path: string }>) {
  const monacoTheme = useMonacoTheme()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const { path } = params

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
        options={OPTIONS}
        onMount={(editor) => {
          editorRef.current = editor
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
