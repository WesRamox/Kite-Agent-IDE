import type { Result } from '@shared/types'
import { openWorktree as openWorktreeWorkspace } from '../../app/workspace.actions'
import { getDockApi } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { basename } from '../../lib/paths'
import { toast } from '../../stores/toast.store'
import { refreshGit } from './git-sync'
import { useGitStore } from './git.store'

export const DIFF_COMPONENT = 'diff'
const DIFF_PREFIX = 'diff:'

export interface DiffParams {
  path: string
  staged: boolean
}

export function isDiffPanel(id: string): boolean {
  return id.startsWith(DIFF_PREFIX)
}

function root(): string | null {
  return useGitStore.getState().root
}

async function run<T>(call: (root: string) => Promise<Result<T>>, context: string) {
  const r = root()
  if (!r) return null
  const result = await attempt(call(r), context)
  await refreshGit()
  return result
}

export function stage(paths: string[]) {
  return run((r) => window.api.git.stage(r, paths), 'Erro ao adicionar ao stage')
}

export function unstage(paths: string[]) {
  return run((r) => window.api.git.unstage(r, paths), 'Erro ao remover do stage')
}

export function stageAll() {
  const status = useGitStore.getState().status
  if (!status?.isRepo) return Promise.resolve(null)
  const paths = status.files.filter((f) => f.unstaged).map((f) => f.path)
  return paths.length > 0 ? stage(paths) : Promise.resolve(null)
}

export function unstageAll() {
  const status = useGitStore.getState().status
  if (!status?.isRepo) return Promise.resolve(null)
  const paths = status.files.filter((f) => f.staged).map((f) => f.path)
  return paths.length > 0 ? unstage(paths) : Promise.resolve(null)
}

export async function commit(message: string): Promise<boolean> {
  const res = await run((r) => window.api.git.commit(r, message), 'Erro no commit')
  if (res) toast.info(`Commit ${res.hash} criado.`)
  return res !== null
}

export function checkout(branch: string, create = false) {
  return run(
    (r) => window.api.git.checkout(r, branch, create),
    create ? 'Erro ao criar branch' : 'Erro ao trocar de branch',
  )
}

export async function createWorktree(branch: string): Promise<string | null> {
  // Branch existente e livre: usa. Senão, cria uma nova a partir do HEAD atual.
  const existing = useGitStore.getState().branches.find((b) => b.name === branch)
  if (existing?.worktreePath) {
    toast.error(`A branch ${branch} já está em uso em ${existing.worktreePath}`)
    return null
  }
  const res = await run(
    (r) => window.api.git.worktreeAdd(r, branch, !existing),
    'Erro ao criar worktree',
  )
  if (res) toast.info(`Worktree criada em ${res.path}`)
  return res?.path ?? null
}

export async function removeWorktree(path: string): Promise<void> {
  const r = root()
  if (!r) return
  const answer = await window.api.dialog.confirm({
    message: `Remover a worktree ${basename(path)}?`,
    detail: `A pasta ${path} será apagada. A branch continua existindo.`,
    buttons: ['Remover', 'Cancelar'],
    kind: 'warning',
  })
  if (!answer.ok || answer.data !== 0) return
  let res = await window.api.git.worktreeRemove(r, path, false)
  if (!res.ok && res.error.code === 'GIT_ERROR') {
    // Normalmente: há alterações não commitadas na worktree.
    const force = await window.api.dialog.confirm({
      message: 'A worktree tem alterações não commitadas.',
      detail: `${res.error.message}\n\nRemover mesmo assim? As alterações serão perdidas.`,
      buttons: ['Remover mesmo assim', 'Cancelar'],
      kind: 'warning',
    })
    if (!force.ok || force.data !== 0) return
    res = await window.api.git.worktreeRemove(r, path, true)
  }
  if (!res.ok) toast.error(`Erro ao remover worktree: ${res.error.message}`)
  await refreshGit()
}

export function openWorktree(path: string): Promise<void> {
  return openWorktreeWorkspace(path)
}

export function openDiff(path: string, staged: boolean): void {
  const dock = getDockApi()
  if (!dock) return
  const id = `${DIFF_PREFIX}${staged ? 'staged' : 'working'}:${path}`
  const existing = dock.getPanel(id)
  if (existing) {
    existing.api.setActive()
    return
  }
  const params: DiffParams = { path, staged }
  dock.addPanel({
    id,
    component: DIFF_COMPONENT,
    tabComponent: DIFF_COMPONENT,
    title: `${basename(path)} (${staged ? 'stage' : 'alterações'})`,
    params,
  })
}

export function closeDiff(id: string): void {
  const dock = getDockApi()
  const panel = dock?.getPanel(id)
  if (dock && panel) dock.removePanel(panel)
}
