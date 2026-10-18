import type { GitDiff, ReviewRepo, TaskReview } from '@shared/types'
import { useIpcQuery, type IpcQuery, type IpcQueryOptions } from '../../lib/use-ipc-query'
import { useWorkspaceStore } from '../../stores/workspace.store'

// Revisão da tarefa: o que mudou em cada repo contra a base.
export function useTaskReview(
  taskId: string,
  options: Pick<IpcQueryOptions<TaskReview>, 'refresh' | 'onData'>,
): IpcQuery<TaskReview> {
  const root = useWorkspaceStore((s) => s.root)
  return useIpcQuery(
    () => (root ? window.api.review.task(root, taskId, {}) : null),
    [root, taskId],
    { ...options, identity: taskId },
  )
}

// Diff de um arquivo da tarefa contra o merge-base do repo dele.
export function useTaskReviewDiff(
  taskId: string,
  repo: ReviewRepo,
  rel: string,
): IpcQuery<GitDiff> {
  const root = useWorkspaceStore((s) => s.root)
  const { worktree, base } = repo
  return useIpcQuery(
    () => (root ? window.api.review.diff(root, taskId, worktree, base, rel) : null),
    [root, taskId, worktree, base, rel],
    { identity: `${worktree}\0${rel}` },
  )
}
