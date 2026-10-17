import { useState } from 'react'
import { openFolder } from '../../app/workspace.actions'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useGitStore } from '../git/git.store'
import {
  openAgentTerminal,
  openReview,
  removeAgent,
  restartAgent,
  stopAgent,
} from './agents.actions'
import {
  GROUP_LABEL,
  GROUP_ORDER,
  shortKey,
  groupItems,
  type AttentionGroup,
  type AttentionItem,
} from './attention'
import { focusItem } from './attention.actions'
import { useAttentionStore } from './attention.store'
import { NewTaskForm } from './NewTaskForm'
import { PresetEditor } from './PresetEditor'
import { tildePath } from './session-format'
import { openTask, setTaskHidden } from '../tasks/tasks.actions'
import { useTasksStore } from '../tasks/tasks.store'
import { useAttentionItems } from './use-attention'

// Sidebar da Central de atenção (canvas, tela 1: Main.dc.html, coluna "Tarefas").

const GROUP_DOT: Record<AttentionGroup, string> = {
  waiting: 'bg-accent',
  running: 'bg-info',
  review: 'bg-success',
  idle: 'bg-fg-muted/50',
}

function taskMenu(item: AttentionItem): MenuItem[] {
  const ws = item.wsTask
  if (ws) {
    return [
      { label: 'Abrir tarefa', onSelect: () => void openTask(ws.id) },
      { label: 'Esconder da Central', onSelect: () => void setTaskHidden(ws.id, true) },
    ]
  }
  const task = item.task
  if (!task) return []
  return [
    { label: 'Terminal do agente', onSelect: () => openAgentTerminal(task.id) },
    { label: 'Revisar alterações', onSelect: () => openReview(task.id) },
    task.alive
      ? { label: 'Parar agente', onSelect: () => void stopAgent(task.id) }
      : { label: 'Reiniciar agente', onSelect: () => void restartAgent(task.id) },
    { label: 'Remover tarefa', danger: true, onSelect: () => void removeAgent(task.id) },
  ]
}

export function AttentionSidebar() {
  const items = useAttentionItems()
  const repos = useTasksStore((s) => s.workspace?.repos.length ?? 0)
  const mode = useAttentionStore((s) => s.mode)
  const highlighted = useAttentionStore((s) => s.highlighted)
  const root = useWorkspaceStore((s) => s.root)
  const isRepo = useGitStore((s) => s.status?.isRepo ?? false)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const groups = groupItems(items)
  const setMode = (m: typeof mode) => useAttentionStore.getState().set({ mode: m })
  const empty = GROUP_ORDER.every((g) => groups[g].length === 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col font-geist">
      <div className="flex flex-col gap-2.5 border-b border-border px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
            Tarefas
          </span>
          <button
            type="button"
            aria-pressed={mode === 'new'}
            onClick={() => setMode(mode === 'new' ? 'list' : 'new')}
            className="h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3"
          >
            + Nova
          </button>
        </div>
        <button
          type="button"
          title={root ?? 'Abrir pasta'}
          onClick={() => void openFolder()}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface-0 px-2.5 text-left text-fg hover:border-fg-muted/40"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 stroke-fg-muted"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M3 6h6l2 2h10v11H3z" />
          </svg>
          <span className="min-w-0 flex-1 truncate">{root ? tildePath(root) : 'Abrir pasta'}</span>
          {(repos > 0 || isRepo) && (
            <span className="text-[11px] text-fg-muted">
              {Math.max(repos, 1)} {Math.max(repos, 1) === 1 ? 'repo' : 'repos'}
            </span>
          )}
        </button>
      </div>
      {mode === 'new' && <NewTaskForm onDone={() => setMode('list')} />}
      {mode === 'presets' && <PresetEditor onDone={() => setMode('list')} />}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 py-2">
        {empty && (
          <p className="px-2.5 py-4 text-xs leading-normal text-fg-muted">
            Nenhum agente ainda. Crie uma tarefa em “+ Nova” ou conecte o Claude Code para ver as
            sessões abertas em qualquer terminal.
          </p>
        )}
        {GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => (
          <div key={g} className="flex flex-col gap-0.5" role="group" aria-label={GROUP_LABEL[g]}>
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
              <span className={`size-2 rounded-full ${GROUP_DOT[g]}`} />
              {GROUP_LABEL[g]}
              <span className="ml-auto font-medium">{groups[g].length}</span>
            </div>
            {groups[g].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Tarefa ${item.name}`}
                // Tarefa sem agente não tem cartão na Central: abre a tarefa direto.
                onClick={() =>
                  item.wsTask && item.group === 'idle'
                    ? void openTask(item.wsTask.id)
                    : focusItem(item)
                }
                onContextMenu={(e) => {
                  const items = taskMenu(item)
                  if (items.length === 0) return
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, items })
                }}
                className={`flex flex-col gap-[3px] rounded-md px-2.5 py-2 text-left text-fg ${
                  highlighted === item.id ? 'bg-surface-3' : 'hover:bg-surface-2'
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-geist-mono text-[11px] text-fg-muted">
                    {shortKey(item)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </span>
                <span className="text-[11px] text-fg-muted" aria-label="Status">
                  {item.meta}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
