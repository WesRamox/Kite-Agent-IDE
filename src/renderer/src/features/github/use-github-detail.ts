import type { IssueDetail, PullDetail } from '@shared/types'
import { useIpcQuery, type IpcQuery } from '../../lib/use-ipc-query'
import { useGitStore } from '../git/git.store'

// Detalhes de um PR ou issue do repositório escolhido nos painéis Git/GitHub.
export function usePullDetail(number: number): IpcQuery<PullDetail> {
  const root = useGitStore((s) => s.root)
  return useIpcQuery(() => (root ? window.api.github.getPR(root, number) : null), [root, number])
}

export function useIssueDetail(number: number): IpcQuery<IssueDetail> {
  const root = useGitStore((s) => s.root)
  return useIpcQuery(() => (root ? window.api.github.getIssue(root, number) : null), [root, number])
}
