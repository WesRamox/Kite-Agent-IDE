import type { AgentReview, GitDiff } from '@shared/types'
import { useIpcQuery, type IpcQuery, type IpcQueryOptions } from '../../lib/use-ipc-query'

// Revisão de um agente do Kite (o que mudou na worktree desde a branch de origem) ou de uma
// sessão fora de tarefa (o que ela editou e ainda não foi commitado).
export type ReviewParams =
  { taskId: string; sessionId?: never } | { sessionId: string; taskId?: never }

export function useAgentReview(
  params: ReviewParams,
  options: Pick<IpcQueryOptions<AgentReview>, 'refresh' | 'onData'>,
): IpcQuery<AgentReview> {
  const { sessionId, taskId } = params
  return useIpcQuery(
    () =>
      sessionId !== undefined
        ? window.api.agentSession.review(sessionId)
        : window.api.agent.review(taskId),
    [sessionId, taskId],
    { ...options, identity: sessionId ?? taskId },
  )
}

// Diff do arquivo selecionado; `refresh` (a revisão atual) refaz a busca quando a lista muda.
export function useAgentReviewDiff(
  params: ReviewParams,
  file: string | null,
  refresh: unknown,
): IpcQuery<GitDiff> {
  const { sessionId, taskId } = params
  return useIpcQuery(
    () =>
      file === null
        ? null
        : sessionId !== undefined
          ? window.api.agentSession.reviewDiff(sessionId, file)
          : window.api.agent.reviewDiff(taskId, file),
    [sessionId, taskId, file],
    { refresh, identity: `${sessionId ?? taskId}\0${file ?? ''}` },
  )
}
