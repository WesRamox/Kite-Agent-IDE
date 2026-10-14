import { attempt } from '../../lib/ipc'
import { basename, dirname, isValidName, join } from '../../lib/paths'
import { toast } from '../../stores/toast.store'
import { closeUnder, openFile, renameUnder } from '../editor/editor.actions'
import { useExplorerStore } from './explorer.store'

export async function createEntry(parent: string, kind: 'file' | 'directory', name: string) {
  const explorer = useExplorerStore.getState()
  explorer.stopEditing()
  const trimmed = name.trim()
  if (trimmed === '') return
  if (!isValidName(trimmed)) {
    toast.error(`Nome inválido: "${trimmed}"`)
    return
  }
  const target = join(parent, trimmed)
  const ok = await attempt(window.api.fs.create(target, kind), `Erro ao criar ${trimmed}`)
  if (ok === null) return
  await explorer.refresh([parent])
  if (kind === 'file') await openFile(target)
}

export async function renameEntry(from: string, newName: string) {
  const explorer = useExplorerStore.getState()
  explorer.stopEditing()
  const trimmed = newName.trim()
  if (trimmed === '' || trimmed === basename(from)) return
  if (!isValidName(trimmed)) {
    toast.error(`Nome inválido: "${trimmed}"`)
    return
  }
  const to = join(dirname(from), trimmed)
  const ok = await attempt(window.api.fs.rename(from, to), `Erro ao renomear ${basename(from)}`)
  if (ok === null) return
  explorer.forget(from)
  renameUnder(from, to)
  await explorer.refresh([dirname(from)])
}

export async function deleteEntry(target: string, kind: 'file' | 'directory') {
  const answer = await window.api.dialog.confirm({
    message: `Mover "${basename(target)}" para a lixeira?`,
    detail: kind === 'directory' ? 'A pasta e todo o seu conteúdo serão movidos.' : undefined,
    buttons: ['Mover para a lixeira', 'Cancelar'],
    kind: 'warning',
  })
  if (!answer.ok || answer.data !== 0) return
  const ok = await attempt(window.api.fs.delete(target), `Erro ao excluir ${basename(target)}`)
  if (ok === null) return
  closeUnder(target)
  const explorer = useExplorerStore.getState()
  explorer.forget(target)
  await explorer.refresh([dirname(target)])
}

// Começa a criação inline. O alvo pode ser uma pasta (cria dentro), um arquivo (cria ao
// lado) ou nada (cria na raiz). `openDir` expande a pasta na árvore.
export function beginCreate(
  root: string,
  kind: 'file' | 'directory',
  target: { id: string; kind: 'file' | 'directory' } | null,
  openDir: (dir: string) => void,
): void {
  const explorer = useExplorerStore.getState()
  const parent = !target ? root : target.kind === 'directory' ? target.id : dirname(target.id)
  if (parent !== root) openDir(parent)
  if (!(parent in explorer.children)) void explorer.load(parent)
  explorer.startCreate({ parent, kind })
}
