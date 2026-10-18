import type { CreatePullInput } from '@shared/types'
import { openWorktree } from '../../app/workspace.actions'
import { getDockApi } from '../../lib/dock'
import { attempt } from '../../lib/ipc'
import { toast } from '../../stores/toast.store'
import { useGitStore } from '../git/git.store'
import { refreshGit } from '../git/git-sync'
import { useGitHubStore } from './github.store'
import { t } from '../../lib/i18n'

export const PR_COMPONENT = 'github-pr'
export const ISSUE_COMPONENT = 'github-issue'
export const CREATE_PR_COMPONENT = 'github-create-pr'
export const GITHUB_TAB_COMPONENT = 'github-tab'
const PREFIX = 'github:'

export function isGitHubPanel(id: string): boolean {
  return id.startsWith(PREFIX)
}

const store = () => useGitHubStore.getState()
// Mesmo repositório do painel Git (segue a tarefa aberta).
const root = () => useGitStore.getState().root

export async function loadAuth(): Promise<void> {
  const res = await window.api.github.me()
  store().set({ auth: res.ok ? res.data : { configured: false, user: null, secureStorage: false } })
  if (!res.ok) toast.error(`GitHub: ${res.error.message}`)
}

let loginToken = 0

// Device Flow: mostra o código, abre o navegador e consulta até o usuário autorizar.
export async function login(): Promise<void> {
  const token = ++loginToken
  store().set({ login: { kind: 'starting' } })
  const started = await window.api.github.startDeviceFlow()
  if (token !== loginToken) return
  if (!started.ok) {
    store().set({ login: { kind: 'error', message: started.error.message } })
    return
  }
  const flow = started.data
  store().set({ login: { kind: 'waiting', flow } })
  void window.api.clipboard.writeText(flow.userCode)
  window.open(flow.verificationUri, '_blank')

  let interval = flow.interval
  while (token === loginToken) {
    await new Promise((r) => setTimeout(r, interval * 1000))
    if (token !== loginToken) return
    const res = await window.api.github.pollDeviceFlow(flow.flowId)
    if (token !== loginToken) return
    if (!res.ok) {
      store().set({ login: { kind: 'error', message: res.error.message } })
      return
    }
    const poll = res.data
    if (poll.status === 'pending') continue
    if (poll.status === 'slow_down') {
      interval = poll.interval
      continue
    }
    if (poll.status === 'success') {
      store().set({ login: { kind: 'idle' } })
      await loadAuth()
      toast.info(t('github.connected', { login: poll.user.login }))
      await loadRepo()
      return
    }
    store().set({
      login: {
        kind: 'error',
        message: poll.status === 'denied' ? t('github.denied') : t('github.expired'),
      },
    })
    return
  }
}

export function cancelLogin(): void {
  loginToken++
  store().set({ login: { kind: 'idle' } })
}

export async function logout(): Promise<void> {
  await attempt(window.api.github.logout(), t('github.signOutError'))
  store().set({ prs: null, issues: null, repo: undefined })
  await loadAuth()
}

export async function loadRepo(): Promise<void> {
  const r = root()
  if (!r || !store().auth?.user) {
    store().set({ repo: undefined, prs: null, issues: null })
    return
  }
  store().set({ repo: undefined, repoError: null })
  const res = await window.api.github.repo(r)
  if (root() !== r) return
  if (!res.ok) {
    if (res.error.code === 'NOT_AUTHENTICATED') await loadAuth()
    store().set({ repo: null, repoError: res.error.message })
    return
  }
  store().set({ repo: res.data })
  if (res.data) await loadList()
}

export async function loadList(): Promise<void> {
  const r = root()
  const { tab, filter, repo } = store()
  if (!r || !repo) return
  const stale = () => root() !== r || store().tab !== tab || store().filter !== filter
  store().set({ listError: null })
  if (tab === 'prs') {
    store().set({ prs: null })
    const res = await window.api.github.listPRs(r, filter)
    if (stale()) return
    store().set(res.ok ? { prs: res.data } : { listError: res.error.message })
  } else {
    store().set({ issues: null })
    const res = await window.api.github.listIssues(r, filter)
    if (stale()) return
    store().set(res.ok ? { issues: res.data } : { listError: res.error.message })
  }
}

function openPanel(id: string, component: string, title: string, params: object): void {
  const dock = getDockApi()
  if (!dock) return
  const existing = dock.getPanel(id)
  if (existing) {
    existing.api.setActive()
    return
  }
  dock.addPanel({ id, component, tabComponent: GITHUB_TAB_COMPONENT, title, params })
}

export function openPull(number: number, title: string): void {
  openPanel(`${PREFIX}pr:${number}`, PR_COMPONENT, `#${number} ${title}`, { number })
}

export function openIssue(number: number, title: string): void {
  openPanel(`${PREFIX}issue:${number}`, ISSUE_COMPONENT, `#${number} ${title}`, { number })
}

export function openCreatePull(): void {
  openPanel(`${PREFIX}create-pr`, CREATE_PR_COMPONENT, t('github.newPRTab'), {})
}

export function closeGitHubPanel(id: string): void {
  const dock = getDockApi()
  const panel = dock?.getPanel(id)
  if (dock && panel) dock.removePanel(panel)
}

// Baixa o PR, cria a worktree e a abre como workspace.
export async function checkoutPull(number: number): Promise<void> {
  const r = root()
  if (!r) return
  const res = await attempt(
    window.api.github.checkoutPR(r, number),
    t('github.checkoutError', { number }),
  )
  if (!res) return
  toast.info(t('github.checkedOut', { number, branch: res.branch }))
  await openWorktree(res.path)
}

export async function createPull(input: CreatePullInput): Promise<boolean> {
  const r = root()
  if (!r) return false
  const res = await attempt(window.api.github.createPR(r, input), t('github.createPRError'))
  await refreshGit()
  if (!res) return false
  toast.info(t('github.prCreated', { number: res.number }))
  closeGitHubPanel(`${PREFIX}create-pr`)
  openPull(res.number, input.title)
  if (store().tab === 'prs') void loadList()
  return true
}
