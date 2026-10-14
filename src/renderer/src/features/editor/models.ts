import type { FileEncoding } from '@shared/types'
import { basename } from '../../lib/paths'
import { useEditorStore } from './editor.store'
import { detectLanguage } from './language'
import { monaco } from './monaco-setup'

interface ModelEntry {
  model: monaco.editor.ITextModel
  encoding: FileEncoding
  // Versão e conteúdo da última vez que o modelo bateu com o disco.
  savedVersion: number
  savedContent: string
  listener: monaco.IDisposable
}

const entries = new Map<string, ModelEntry>()

export function uriFor(path: string): monaco.Uri {
  return monaco.Uri.file(path)
}

export function hasModel(path: string): boolean {
  return entries.has(path)
}

export function getEntry(path: string): Readonly<ModelEntry> | undefined {
  return entries.get(path)
}

export function openPaths(): string[] {
  return [...entries.keys()]
}

export function isDirty(path: string): boolean {
  const e = entries.get(path)
  return !!e && e.model.getAlternativeVersionId() !== e.savedVersion
}

export function createModel(
  path: string,
  content: string,
  encoding: FileEncoding,
  dirtyFrom?: string,
): monaco.editor.ITextModel {
  const existing = entries.get(path)
  if (existing) return existing.model
  const language = detectLanguage(basename(path), monaco.languages.getLanguages())
  const model = monaco.editor.createModel(content, language, uriFor(path))
  const savedContent = dirtyFrom ?? content
  const entry: ModelEntry = {
    model,
    encoding,
    // Um modelo criado a partir de conteúdo não salvo começa "sujo".
    savedVersion: dirtyFrom === undefined ? model.getAlternativeVersionId() : -1,
    savedContent,
    listener: model.onDidChangeContent(() =>
      useEditorStore.getState().setDirty(path, isDirty(path)),
    ),
  }
  entries.set(path, entry)
  useEditorStore.getState().setTab(path, { dirty: isDirty(path), language })
  return model
}

export function markSaved(path: string, content: string): void {
  const e = entries.get(path)
  if (!e) return
  e.savedVersion = e.model.getAlternativeVersionId()
  e.savedContent = content
  useEditorStore.getState().setDirty(path, isDirty(path))
}

// Registra o conteúdo do disco sem mexer no modelo (usuário escolheu manter suas alterações).
export function acknowledgeDisk(path: string, content: string): void {
  const e = entries.get(path)
  if (!e) return
  e.savedContent = content
  e.savedVersion = -1
  useEditorStore.getState().setDirty(path, true)
}

// Substitui o conteúdo preservando o histórico de desfazer.
export function replaceContent(path: string, content: string): void {
  const e = entries.get(path)
  if (!e) return
  e.model.pushEditOperations(
    [],
    [{ range: e.model.getFullModelRange(), text: content }],
    () => null,
  )
  markSaved(path, content)
}

export function disposeModel(path: string): void {
  const e = entries.get(path)
  if (!e) return
  e.listener.dispose()
  e.model.dispose()
  entries.delete(path)
  useEditorStore.getState().removeTab(path)
}
