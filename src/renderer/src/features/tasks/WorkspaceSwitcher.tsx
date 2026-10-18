import { isMac } from '../../lib/platform'
import { basename } from '../../lib/paths'
import { useT } from '../../lib/i18n'
import { useTaskSwitcherStore } from './task-switcher.store'
import { useTasksStore } from './tasks.store'

// Topo do explorer do workspace (sem tarefa aberta): o mesmo seletor do explorer da tarefa, para
// escolher uma tarefa sem ir ao menu. Só aparece num workspace com tarefas importadas.
export function WorkspaceSwitcher() {
  const tr = useT()
  const root = useTasksStore((s) => s.workspace?.root ?? null)
  const count = useTasksStore((s) =>
    s.workspace?.imported ? s.workspace.tasks.filter((t) => !t.hidden).length : 0,
  )
  if (!root || count === 0) return null
  const mod = isMac ? '⌘' : 'Ctrl+'

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3 font-geist">
      <button
        type="button"
        aria-label={tr('workspaceSwitcher.choose')}
        onClick={() => useTaskSwitcherStore.getState().show()}
        className="flex items-center gap-2 rounded-[7px] border border-border bg-surface-0 px-2.5 py-2 text-left text-fg hover:border-fg-muted/40"
      >
        <span className="size-2 shrink-0 rounded-full bg-fg-muted/50" />
        <span className="font-geist-mono text-[11px] text-fg-muted">
          {tr('workspaceSwitcher.label')}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{basename(root)}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 stroke-fg-muted"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      <span className="text-[11px] text-fg-muted">
        {tr('workspaceSwitcher.hint', { mod, n: count })}
      </span>
    </div>
  )
}
