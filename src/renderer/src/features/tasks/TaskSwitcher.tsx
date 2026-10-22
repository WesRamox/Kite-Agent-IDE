import { useEffect, useMemo, useRef, useState } from 'react'
import { fuzzyFilter } from '../../lib/fuzzy'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { tildePath } from '../../lib/session-format'
import { TaskDot } from './TaskDot'
import { openDiscover, openTask, showWorkspace } from './tasks.actions'
import { isShownTask, useTasksStore } from './tasks.store'
import { useTaskSwitcherStore } from './task-switcher.store'
import { useT } from '../../lib/i18n'

// Ctrl/Cmd+K: troca de tarefa (cada uma guarda as próprias abas e terminais).
export function TaskSwitcher() {
  const open = useTaskSwitcherStore((s) => s.open)
  const ws = useTasksStore((s) => s.workspace)
  if (!open || !ws) return null
  return <SwitcherDialog />
}

const DISCOVER = '\0discover'

interface Entry {
  id: string | null
  label: string
  detail: string
}

function SwitcherDialog() {
  const ws = useTasksStore((s) => s.workspace)
  const active = useTasksStore((s) => s.activeTaskId)
  const root = useWorkspaceStore((s) => s.root)
  const hide = useTaskSwitcherStore((s) => s.hide)
  const tr = useT()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const entries: Entry[] = useMemo(
    () => [
      { id: null, label: tr('switcher.workspace'), detail: root ? tildePath(root) : '' },
      ...(ws?.tasks ?? []).filter(isShownTask).map((t) => ({
        id: t.id,
        label: `${t.key} · ${t.name}`,
        detail: t.worktrees.map((w) => w.repoName).join(', '),
      })),
      { id: DISCOVER, label: tr('switcher.discover'), detail: tr('switcher.discoverDetail') },
    ],
    [ws, root, tr],
  )
  const items = useMemo(() => fuzzyFilter(query, entries, (e) => e.label, 50), [query, entries])

  const choose = (index: number) => {
    const entry = items[index]?.item
    if (!entry) return
    hide()
    if (entry.id === DISCOVER) openDiscover()
    else if (entry.id) void openTask(entry.id)
    else showWorkspace()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/30 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && hide()}
    >
      <div
        role="dialog"
        aria-label={tr('switcher.label')}
        className="flex h-fit max-h-[60vh] w-[560px] flex-col overflow-hidden rounded-[10px] border border-border bg-surface-1 font-geist text-[13px] text-fg shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          placeholder={tr('switcher.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') hide()
            else if (e.key === 'ArrowDown') setSelected((i) => Math.min(i + 1, items.length - 1))
            else if (e.key === 'ArrowUp') setSelected((i) => Math.max(i - 1, 0))
            else if (e.key === 'Enter') choose(selected)
            else return
            e.preventDefault()
          }}
          className="h-11 border-b border-border bg-transparent px-4 text-fg outline-none placeholder:text-fg-muted"
        />
        <ul className="overflow-y-auto p-1.5">
          {items.map(({ item }, i) => (
            <li key={item.id ?? 'workspace'}>
              <button
                type="button"
                onMouseEnter={() => setSelected(i)}
                onClick={() => choose(i)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
                  i === selected ? 'bg-surface-3' : ''
                }`}
              >
                {item.id && item.id !== DISCOVER ? (
                  <TaskDot taskId={item.id} />
                ) : (
                  <span className="size-2" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-xs text-fg-muted">{item.detail}</span>
                {item.id === active && (
                  <span className="text-[11px] text-accent">{tr('switcher.open')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
