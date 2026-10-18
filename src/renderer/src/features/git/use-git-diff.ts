import type { GitDiff } from '@shared/types'
import { useIpcQuery, type IpcQuery } from '../../lib/use-ipc-query'
import { useGitStore } from './git.store'

// Diff de um arquivo no diff editor. Recarrega quando o status do git muda (novo stage, arquivo
// salvo, commit…).
export function useGitDiff(path: string, staged: boolean): IpcQuery<GitDiff> {
  const root = useGitStore((s) => s.root)
  const status = useGitStore((s) => s.status)
  return useIpcQuery(
    () => (root ? window.api.git.diff(root, path, staged) : null),
    [root, path, staged],
    { refresh: status },
  )
}
