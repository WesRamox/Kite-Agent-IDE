import type {
  DeviceFlowStart,
  GitHubAuthState,
  GitHubItemState,
  GitHubRepoRef,
  IssueSummary,
  PullSummary,
} from '@shared/types'
import { create } from 'zustand'

export type GitHubTab = 'prs' | 'issues'

export type LoginState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'waiting'; flow: DeviceFlowStart }
  | { kind: 'error'; message: string }

interface GitHubState {
  auth: GitHubAuthState | null
  login: LoginState
  // undefined = carregando; null = pasta sem remote do GitHub.
  repo: GitHubRepoRef | null | undefined
  repoError: string | null
  tab: GitHubTab
  filter: GitHubItemState
  prs: PullSummary[] | null
  issues: IssueSummary[] | null
  listError: string | null
  set: (patch: Partial<Omit<GitHubState, 'set'>>) => void
}

export const useGitHubStore = create<GitHubState>((set) => ({
  auth: null,
  login: { kind: 'idle' },
  repo: undefined,
  repoError: null,
  tab: 'prs',
  filter: 'open',
  prs: null,
  issues: null,
  listError: null,
  set: (patch) => set(patch),
}))
