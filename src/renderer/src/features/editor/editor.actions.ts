import { attempt } from '../../lib/ipc'
import { getDockApi } from '../../lib/dock'
import { basename, isInside, rebase } from '../../lib/paths'
import { toast } from '../../stores/toast.store'
import { closeDiff, isDiffPanel } from '../git/git.actions'
import { closeTerminal } from '../terminal/terminal.actions'
import { isTerminalPanel } from '../terminal/terminals'
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

export const EDITOR_COMPONENT = 'editor'

export async function openFile(path: string): Promise<void> {
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
        toast.warning(`${basename(path)} é um arquivo binário e não abre no editor.`)
      } else if (res.error.code === 'FILE_TOO_LARGE') {
        toast.warning(`${basename(path)} tem mais de 5 MB e não abre no editor.`)
      } else {
        toast.error(`Não foi possível abrir ${basename(path)}: ${res.error.message}`)
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
    `Erro ao salvar ${basename(path)}`,
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
    message: `Salvar as alterações em ${basename(path)}?`,
    detail: 'Suas alterações serão perdidas se você não salvar.',
    buttons: ['Salvar', 'Não salvar', 'Cancelar'],
    kind: 'warning',
  })
  if (!res.ok || res.data === 2) return false
  if (res.data === 0) return saveFile(path)
  return true
}

function removePanel(path: string): void {
  const dock = getDockApi()
  const panel = dock?.getPanel(path)
  if (dock && panel) dock.removePanel(panel)
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
  if (isTerminalPanel(panel.id)) closeTerminal(panel.id)
  else if (isDiffPanel(panel.id)) closeDiff(panel.id)
  else if (hasModel(panel.id)) await closeFile(panel.id)
}

// Antes de trocar de workspace: salva ou descarta alterações pendentes.
// Retorna false se o usuário cancelar.
export async function resolveAllDirty(): Promise<boolean> {
  const dirty = openPaths().filter(isDirty)
  if (dirty.length === 0) return true
  const res = await window.api.dialog.confirm({
    message: `Há ${dirty.length} arquivo(s) com alterações não salvas.`,
    detail: dirty.map((p) => basename(p)).join(', '),
    buttons: ['Salvar todos', 'Descartar', 'Cancelar'],
    kind: 'warning',
  })
  if (!res.ok || res.data === 2) return false
  if (res.data === 0) {
    for (const p of dirty) if (!(await saveFile(p))) return false
  }
  return true
}

export function closeAllNow(): void {
  for (const p of openPaths()) removePanel(p)
}

// Arquivo ou pasta excluído pela IDE: fecha as abas afetadas sem perguntar.
export function closeUnder(target: string): void {
  for (const p of openPaths()) if (isInside(target, p)) removePanel(p)
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
    removePanel(oldPath)
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
      message: `${basename(path)} foi alterado fora do editor.`,
      detail: 'Você tem alterações não salvas neste arquivo.',
      buttons: ['Recarregar do disco', 'Manter minhas alterações'],
      kind: 'warning',
    })
    if (answer.ok && answer.data === 0) replaceContent(path, disk)
    else acknowledgeDisk(path, disk)
  } finally {
    prompting.delete(path)
  }
}

export function handleExternalDelete(path: string): void {
  if (hasModel(path)) toast.warning(`${basename(path)} foi removido do disco.`)
}
