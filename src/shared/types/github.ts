// GitHub: login, PRs, issues e checks.

export interface GitHubUser {
  login: string
  name: string | null
  avatarUrl: string
}

export interface GitHubAuthState {
  // GITHUB_CLIENT_ID definido.
  configured: boolean
  user: GitHubUser | null
  // false quando o SO não oferece criptografia real: o token fica só em memória.
  secureStorage: boolean
}

export interface DeviceFlowStart {
  flowId: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export type DeviceFlowPoll =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'success'; user: GitHubUser }

export interface GitHubRepoRef {
  owner: string
  repo: string
  defaultBranch: string
  url: string
  private: boolean
}

export type GitHubItemState = 'open' | 'closed' | 'all'

export interface PullSummary {
  number: number
  title: string
  author: string | null
  state: 'open' | 'closed' | 'merged'
  draft: boolean
  headRef: string
  baseRef: string
  updatedAt: string
  url: string
  fromFork: boolean
}

export interface IssueSummary {
  number: number
  title: string
  author: string | null
  state: 'open' | 'closed'
  labels: { name: string; color: string }[]
  comments: number
  updatedAt: string
  url: string
}

export type ChecksState = 'success' | 'failure' | 'pending' | 'none'

export interface CheckRun {
  name: string
  // queued | in_progress | completed (check runs) ou pending | success | failure | error (status)
  status: string
  conclusion: string | null
  url: string | null
}

export interface ChecksSummary {
  state: ChecksState
  runs: CheckRun[]
}

export interface PullDetail extends PullSummary {
  body: string
  headSha: string
  additions: number
  deletions: number
  changedFiles: number
  mergeable: boolean | null
  checks: ChecksSummary
}

export interface IssueDetail extends IssueSummary {
  body: string
}

export interface CreatePullInput {
  title: string
  body: string
  base: string
  draft: boolean
}
