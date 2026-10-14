import type { ChecksState } from '@shared/types'

// Estado de um check individual (check run ou status) no mesmo vocabulário do resumo.
export function runState(run: { status: string; conclusion: string | null }): ChecksState {
  if (
    run.conclusion === 'success' ||
    run.conclusion === 'neutral' ||
    run.conclusion === 'skipped'
  ) {
    return 'success'
  }
  if (!run.conclusion || run.status === 'pending') return 'pending'
  return 'failure'
}
