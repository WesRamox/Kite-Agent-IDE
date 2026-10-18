import type { Result } from '@shared/types'
import { openWorktree as openWorktreeWorkspace } from '../../app/workspace.actions'
import { getDockApi } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { basename } from '../../lib/paths'
import { toast } from '../../stores/toast.store'
import { refreshGit } from './git-sync.actions'
import { useGitStore } from './git.store'
import { t } from '../../lib/i18n'

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
  return run((r) => window.api.git.stage(r, paths), t('git.stageError'))
}

export function unstage(paths: string[]) {
  return run((r) => window.api.git.unstage(r, paths), t('git.unstageError'))
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
  const res = await run((r) => window.api.git.commit(r, message), t('git.commitError'))
  if (res) toast.info(t('git.committed', { hash: res.hash }))
  return res !== null
}

export function checkout(branch: string, create = false) {
  return run(
    (r) => window.api.git.checkout(r, branch, create),
    create ? t('git.createBranchError') : t('git.checkoutError'),
  )
}

export async function createWorktree(branch: string): Promise<string | null> {
  // Branch existente e livre: usa. Senão, cria uma nova a partir do HEAD atual.
  const existing = useGitStore.getState().branches.find((b) => b.name === branch)
  if (existing?.worktreePath) {
    toast.error(t('git.branchInUse', { branch, path: existing.worktreePath }))
    return null
  }
  const res = await run(
    (r) => window.api.git.worktreeAdd(r, branch, !existing),
    t('git.worktreeError'),
  )
  if (res) toast.info(t('git.worktreeCreated', { path: res.path }))
  return res?.path ?? null
}

export async function removeWorktree(path: string): Promise<void> {
  const r = root()
  if (!r) return
  const answer = await window.api.dialog.confirm({
    message: t('git.removeWorktree', { name: basename(path) }),
    detail: t('git.removeWorktreeDetail', { path }),
    buttons: [t('git.remove'), t('common.cancel')],
    kind: 'warning',
  })
  if (!answer.ok || answer.data !== 0) return
  let res = await window.api.git.worktreeRemove(r, path, false)
  if (!res.ok && res.error.code === 'GIT_ERROR') {
    // Normalmente: há alterações não commitadas na worktree.
    const force = await window.api.dialog.confirm({
      message: t('git.dirtyWorktree'),
      detail: t('git.forceDetail', { reason: res.error.message }),
      buttons: [t('git.removeAnyway'), t('common.cancel')],
      kind: 'warning',
    })
    if (!force.ok || force.data !== 0) return
    res = await window.api.git.worktreeRemove(r, path, true)
  }
  if (!res.ok) toast.error(t('git.removeError', { reason: res.error.message }))
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
    title: t('git.diffTitle', { name: basename(path), staged }),
    params,
  })
}

export function closeDiff(id: string): void {
  const dock = getDockApi()
  const panel = dock?.getPanel(id)
  if (dock && panel) dock.removePanel(panel)
}
