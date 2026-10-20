import Editor from '@monaco-editor/react'
import type { NodeProps } from '@xyflow/react'
import { CodeXml, FolderOpen, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { copyText } from '../../../lib/clipboard'
import { CODE_FONT } from '../../../lib/code-font'
import { useT } from '../../../lib/i18n'
import { detectLanguage } from '../../../lib/language'
import { basename } from '../../../lib/paths'
import { useSettingsStore } from '../../../stores/settings.store'
import { openFile } from '../../editor/editor.actions'
import { monaco, useMonacoTheme } from '../../editor/use-monaco'
import type { FlowNodeOf } from '../canvas'
import { pickCodeFile, patchNode, saveCodeFile } from '../canvas.actions'
import { codeHandles } from '../canvas.registry'
import { useCodeFile } from '../use-code-file'
import { NodeFrame } from './NodeFrame'

const LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'json',
  'sql',
  'shell',
  'markdown',
  'html',
  'css',
  'yaml',
] as const

const OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: CODE_FONT,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  bracketPairColorization: { enabled: true },
  fixedOverflowWidgets: true,
  lineNumbersMinChars: 3,
}

// Bloco de código: um arquivo da tarefa (abre pela busca de arquivos, salva com Ctrl+S) ou um
// rascunho escrito ali mesmo, guardado no quadro.
export function CodeNode({ id, data, selected }: NodeProps<FlowNodeOf<'code'>>) {
  const t = useT()
  const theme = useMonacoTheme()
  const fontSize = useSettingsStore((s) => s.settings.editorFontSize)
  const file = useCodeFile(data.path)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const saved = useRef<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Arquivo mudou no disco: entra no editor, a menos que a pessoa tenha alterações não salvas.
  useEffect(() => {
    const editor = editorRef.current
    const content = file.data?.content
    if (!editor || content === undefined || content === saved.current) return
    if (saved.current === null || editor.getValue() === saved.current) editor.setValue(content)
    saved.current = content
    setDirty(editor.getValue() !== content)
  }, [file.data])

  useEffect(() => {
    const path = data.path
    const encoding = file.data?.encoding
    codeHandles.set(id, {
      text: () => editorRef.current?.getValue() ?? data.text ?? '',
      setText: (text) => editorRef.current?.setValue(text),
      save:
        path && encoding
          ? async () => {
              const text = editorRef.current?.getValue() ?? ''
              const ok = await saveCodeFile(path, text, encoding)
              if (ok) {
                saved.current = text
                setDirty(false)
              }
              return ok
            }
          : null,
    })
    return () => {
      codeHandles.delete(id)
    }
  }, [id, data.path, data.text, file.data?.encoding])

  const language = data.path
    ? detectLanguage(basename(data.path), monaco.languages.getLanguages())
    : (data.language ?? 'typescript')
  const ready = !data.path || file.data !== null

  return (
    <NodeFrame
      id={id}
      data={data}
      selected={selected}
      icon={CodeXml}
      title={data.path ? basename(data.path) : t('canvas.code')}
      menu={[
        { label: t('canvas.menu.openFile'), onSelect: () => pickCodeFile(id) },
        ...(data.path
          ? [
              { label: t('canvas.menu.openTab'), onSelect: () => void openFile(data.path ?? '') },
              {
                label: t('canvas.menu.newScratch'),
                onSelect: () =>
                  patchNode(id, (d) =>
                    d.kind === 'code'
                      ? { ...d, path: undefined, text: editorRef.current?.getValue() ?? '' }
                      : d,
                  ),
              },
            ]
          : []),
        {
          label: t('canvas.menu.copyCode'),
          onSelect: () => copyText(editorRef.current?.getValue() ?? ''),
        },
      ]}
      actions={
        <>
          {data.path ? (
            <>
              {dirty && (
                <span title={t('canvas.unsaved')} className="size-2 rounded-full bg-accent" />
              )}
              <button
                type="button"
                aria-label={t('canvas.save')}
                title={t('canvas.saveHint')}
                disabled={!dirty}
                onClick={() => void codeHandles.get(id)?.save?.()}
                className="nodrag flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30"
              >
                <Save size={12} />
              </button>
            </>
          ) : (
            <select
              aria-label={t('canvas.language')}
              value={language}
              onChange={(e) =>
                patchNode(id, (d) => (d.kind === 'code' ? { ...d, language: e.target.value } : d))
              }
              className="nodrag h-6 rounded-md border border-border bg-surface-0 px-1 text-[11px] text-fg-muted outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            aria-label={t('canvas.menu.openFile')}
            title={t('canvas.menu.openFile')}
            onClick={() => pickCodeFile(id)}
            className="nodrag flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <FolderOpen size={12} />
          </button>
        </>
      }
    >
      <div
        data-canvas-code={id}
        // nokey: sem isso o quadro toma a barra de espaço (arrastar a tela) e o espaço some do código.
        className="nodrag nowheel nopan nokey h-full w-full bg-surface-0"
      >
        {file.error ? (
          <p className="p-3 text-xs text-danger">{file.error}</p>
        ) : (
          ready && (
            <Editor
              // Modelo próprio do bloco: não divide o desfazer com a aba do mesmo arquivo.
              path={`kite-canvas:/${id}/${data.path ? basename(data.path) : 'rascunho'}`}
              language={language}
              defaultValue={data.path ? (file.data?.content ?? '') : (data.text ?? '')}
              theme={theme}
              options={{ ...OPTIONS, fontSize }}
              onMount={(editor) => {
                editorRef.current = editor
                saved.current = data.path ? (file.data?.content ?? null) : null
              }}
              onChange={(value = '') => {
                if (data.path) setDirty(value !== saved.current)
                else
                  patchNode(id, (d) =>
                    d.kind === 'code' ? { ...d, text: value.slice(0, 200_000) } : d,
                  )
              }}
            />
          )
        )}
      </div>
    </NodeFrame>
  )
}
