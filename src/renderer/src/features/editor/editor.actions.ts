import { attempt } from '../../lib/ipc'
import { allDocks, findPanel, getDockApi } from '../../lib/dock'
import { basename, isInside, rebase } from '../../lib/paths'
import { toast } from '../../stores/toast.store'
import { closeDiff, isDiffPanel } from '../git/git.actions'
import { closeTerminal } from '../terminal/terminal.actions'
import { isAgentPanel, isTerminalPanel } from '../terminal/terminals'
import { useEditorStore } from './editor.store'
import {
  acknowledgeDisk,
  createModel,
  disposeModel,
  getEntry,
  hasModel,
  isDirty,
  markSaved,
  openPaths,
  replaceContent,
} from './models'
import { closeModal } from '../../stores/modal.store'
import { t } from '../../lib/i18n'

export const EDITOR_COMPONENT = 'editor'

export async function openFile(path: string): Promise<void> {
  closeModal()
  const dock = getDockApi()
  if (!dock) return
  const existing = dock.getPanel(path)
  if (existing) {
    existing.api.setActive()
    return
  }

  if (!hasModel(path)) {
    const res = await window.api.fs.readFile(path)
    if (!res.ok) {
      if (res.error.code === 'BINARY_FILE') {
        toast.warning(t('editor.binary', { file: basename(path) }))
      } else if (res.error.code === 'FILE_TOO_LARGE') {
        toast.warning(t('editor.tooLarge', { file: basename(path) }))
      } else {
        toast.error(t('editor.openError', { file: basename(path), reason: res.error.message }))
      }
      return
    }
    createModel(path, res.data.content, res.data.encoding)
  }

  dock.addPanel({
    id: path,
    component: EDITOR_COMPONENT,
    tabComponent: EDITOR_COMPONENT,
    title: basename(path),
    params: { path },
  })
}

export async function saveFile(path: string): Promise<boolean> {
  const entry = getEntry(path)
  if (!entry) return false
  const content = entry.model.getValue()
  const ok = await attempt(
    window.api.fs.writeFile(path, content, entry.encoding),
    t('editor.saveError', { file: basename(path) }),
  )
  if (ok === null) return false
  markSaved(path, content)
  return true
}

export async function saveActive(): Promise<void> {
  const path = useEditorStore.getState().activePath
  if (path) await saveFile(path)
}

// Pergunta o que fazer com alterações não salvas. Retorna false se o usuário cancelar.
async function resolveDirty(path: string): Promise<boolean> {
  if (!isDirty(path)) return true
  const res = await window.api.dialog.confirm({
    message: t('editor.saveChanges', { file: basename(path) }),
    detail: t('editor.saveChangesDetail'),
    buttons: [t('editor.save'), t('editor.dontSave'), t('common.cancel')],
    kind: 'warning',
  })
  if (!res.ok || res.data === 2) return false
  if (res.data === 0) return saveFile(path)
  return true
}

// Fecha a aba (no contexto ativo, se ela estiver lá). O modelo só é liberado quando nenhuma
// outra tarefa aberta mostra o mesmo arquivo.
function removePanel(path: string): void {
  const found = findPanel(path)
  if (found) found.dock.removePanel(found.panel)
  if (!findPanel(path)) disposeModel(path)
}

// Fecha o arquivo em todos os contextos.
function removeEverywhere(path: string): void {
  for (const dock of allDocks()) {
    const panel = dock.getPanel(path)
    if (panel) dock.removePanel(panel)
  }
  disposeModel(path)
}

export async function closeFile(path: string): Promise<boolean> {
  if (!(await resolveDirty(path))) return false
  removePanel(path)
  return true
}

export async function closeActive(): Promise<void> {
  const panel = getDockApi()?.activePanel
  if (!panel) return
  if (isTerminalPanel(panel.id) || isAgentPanel(panel.id)) closeTerminal(panel.id)
  else if (isDiffPanel(panel.id)) closeDiff(panel.id)
  else if (hasModel(panel.id)) await closeFile(panel.id)
  // Painéis sem estado próprio (GitHub etc.): só remove.
  else getDockApi()?.removePanel(panel)
}

// Antes de trocar de workspace: salva ou descarta alterações pendentes.
// Retorna false se o usuário cancelar.
export async function resolveAllDirty(): Promise<boolean> {
  const dirty = openPaths().filter(isDirty)
  if (dirty.length === 0) return true
  const res = await window.api.dialog.confirm({
    message: t('editor.unsaved', { n: dirty.length }),
    detail: dirty.map((p) => basename(p)).join(', '),
    buttons: [t('editor.saveAll'), t('editor.discard'), t('common.cancel')],
    kind: 'warning',
  })
  if (!res.ok || res.data === 2) return false
  if (res.data === 0) {
    for (const p of dirty) if (!(await saveFile(p))) return false
  }
  return true
}

export function closeAllNow(): void {
  for (const p of openPaths()) removeEverywhere(p)
}

// Arquivo ou pasta excluído pela IDE: fecha as abas afetadas sem perguntar.
export function closeUnder(target: string): void {
  for (const p of openPaths()) if (isInside(target, p)) removeEverywhere(p)
}

// Arquivo ou pasta renomeado pela IDE: reabre as abas afetadas no novo caminho,
// preservando o conteúdo (e o estado "não salvo").
export function renameUnder(from: string, to: string): void {
  const dock = getDockApi()
  for (const oldPath of openPaths()) {
    if (!isInside(from, oldPath)) continue
    const entry = getEntry(oldPath)
    if (!entry) continue
    const newPath = rebase(oldPath, from, to)
    const content = entry.model.getValue()
    const dirty = isDirty(oldPath)
    const wasActive = dock?.activePanel?.id === oldPath
    removeEverywhere(oldPath)
    createModel(newPath, content, entry.encoding, dirty ? entry.savedContent : undefined)
    dock?.addPanel({
      id: newPath,
      component: EDITOR_COMPONENT,
      tabComponent: EDITOR_COMPONENT,
      title: basename(newPath),
      params: { path: newPath },
      inactive: !wasActive,
    })
  }
}

const prompting = new Set<string>()

// Arquivo aberto mudou no disco: recarrega se não há alterações locais, senão pergunta.
export async function handleExternalChange(path: string): Promise<void> {
  if (!hasModel(path) || prompting.has(path)) return
  const res = await window.api.fs.readFile(path)
  const entry = getEntry(path)
  if (!res.ok || !entry) return
  const disk = res.data.content
  // Eco do nosso próprio salvamento, ou nada mudou de fato.
  if (disk === entry.savedContent) return
  if (disk === entry.model.getValue()) {
    markSaved(path, disk)
    return
  }
  if (!isDirty(path)) {
    replaceContent(path, disk)
    return
  }
  prompting.add(path)
  try {
    const answer = await window.api.dialog.confirm({
      message: t('editor.changedOutside', { file: basename(path) }),
      detail: t('editor.changedOutsideDetail'),
      buttons: [t('editor.reload'), t('editor.keepMine')],
      kind: 'warning',
    })
    if (answer.ok && answer.data === 0) replaceContent(path, disk)
    else acknowledgeDisk(path, disk)
  } finally {
    prompting.delete(path)
  }
}

export function handleExternalDelete(path: string): void {
  if (hasModel(path)) toast.warning(t('editor.deleted', { file: basename(path) }))
}
