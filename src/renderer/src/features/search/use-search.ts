import type { SearchResult } from '@shared/types'
import { useIpcQuery, type IpcQuery } from '../../lib/use-ipc-query'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useTasksStore } from '../tasks/tasks.store'
import { useSearchStore } from './search.store'

// Espera depois da última tecla antes de buscar.
const TYPING_DELAY_MS = 250

// Resultado da busca na tarefa aberta. Sem tarefa ou sem texto, não busca.
export function useTaskSearch(): IpcQuery<SearchResult> & { taskId: string | null } {
  const root = useWorkspaceStore((s) => s.root)
  const taskId = useTasksStore((s) => s.activeTaskId)
  const text = useSearchStore((s) => s.text)
  const caseSensitive = useSearchStore((s) => s.caseSensitive)
  const wholeWord = useSearchStore((s) => s.wholeWord)
  const regex = useSearchStore((s) => s.regex)
  const include = useSearchStore((s) => s.include)
  const exclude = useSearchStore((s) => s.exclude)
  const query = useIpcQuery(
    () =>
      root && taskId && text.trim()
        ? window.api.search.task(root, taskId, {
            text,
            caseSensitive,
            wholeWord,
            regex,
            include,
            exclude,
          })
        : null,
    [root, taskId, text, caseSensitive, wholeWord, regex, include, exclude],
    { delayMs: TYPING_DELAY_MS, identity: `${taskId ?? ''}\n${text}` },
  )
  return { ...query, taskId }
}
