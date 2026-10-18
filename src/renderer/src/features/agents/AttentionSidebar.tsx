import { useState } from 'react'
import { openFolder } from '../../app/workspace.actions'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useGitStore } from '../git/git.store'
import {
  openAgentTerminal,
  openReview,
  openSessionReview,
  removeAgent,
  restartAgent,
  stopAgent,
} from './agents.actions'
import {
  groupLabel,
  GROUP_ORDER,
  shortKey,
  groupItems,
  type AttentionGroup,
  type AttentionItem,
} from './attention'
import { focusItem } from './attention.actions'
import { dismissReview } from './sessions.actions'
import { useAttentionStore } from './attention.store'
import { NewTaskForm } from './NewTaskForm'
import { PresetEditor } from './PresetEditor'
import { tildePath } from './session-format'
import { openTaskReview } from '../tasks/review.actions'
import { openDiscover, openTask, setTaskHidden } from '../tasks/tasks.actions'
import { useTasksStore } from '../tasks/tasks.store'
import { useAttentionItems } from './use-attention'
import { t, useT } from '../../lib/i18n'

// Sidebar da Central de atenção (canvas, tela 1: Main.dc.html, coluna "Tarefas").

const GROUP_DOT: Record<AttentionGroup, string> = {
  waiting: 'bg-accent',
  running: 'bg-info',
  review: 'bg-success',
  idle: 'bg-fg-muted/50',
}

// Em "Para revisar", todo item pode ser revisado e dispensado (inclusive sessões fora de tarefa).
function itemMenu(item: AttentionItem): MenuItem[] {
  const menu = taskMenu(item)
  if (item.group !== 'review') return menu
  const session = item.session
  return [
    ...(menu.length === 0 && session
      ? [
          {
            label: t('sidebar.menu.review'),
            onSelect: () => openSessionReview(session.id, item.name),
          },
        ]
      : menu),
    { label: t('central.dismissHint'), onSelect: () => void dismissReview(item) },
  ]
}

function taskMenu(item: AttentionItem): MenuItem[] {
  const ws = item.wsTask
  const task = item.task
  // Ações do agente do Kite (quando há um, inclusive dentro de uma tarefa multi-repo).
  const agent: MenuItem[] = task
    ? [
        { label: t('sidebar.menu.terminal'), onSelect: () => openAgentTerminal(task.id) },
        task.alive
          ? { label: t('sidebar.menu.stop'), onSelect: () => void stopAgent(task.id) }
          : { label: t('sidebar.menu.restart'), onSelect: () => void restartAgent(task.id) },
      ]
    : []
  if (ws) {
    return [
      { label: t('sidebar.menu.openTask'), onSelect: () => void openTask(ws.id) },
      { label: t('sidebar.menu.reviewTask'), onSelect: () => void openTaskReview(ws.id) },
      ...agent,
      ...(task
        ? [
            {
              label: t('sidebar.menu.removeAgent'),
              danger: true,
              onSelect: () => void removeAgent(task.id),
            },
          ]
        : []),
      { label: t('sidebar.menu.hide'), onSelect: () => void setTaskHidden(ws.id, true) },
    ]
  }
  if (!task) return []
  return [
    agent[0] as MenuItem,
    { label: t('sidebar.menu.review'), onSelect: () => openReview(task.id) },
    agent[1] as MenuItem,
    {
      label: t('sidebar.menu.removeTask'),
      danger: true,
      onSelect: () => void removeAgent(task.id),
    },
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
  const tr = useT()

  return (
    <div className="flex min-h-0 flex-1 flex-col font-geist">
      <div className="flex flex-col gap-2.5 border-b border-border px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
            {tr('sidebar.tasks')}
          </span>
          <div className="flex items-center gap-1.5">
            {root && (
              <button
                type="button"
                title={tr('sidebar.discoverHint')}
                onClick={openDiscover}
                className="h-[26px] rounded-md border border-border bg-transparent px-2.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                {tr('sidebar.discover')}
              </button>
            )}
            <button
              type="button"
              aria-pressed={mode === 'new'}
              onClick={() => setMode(mode === 'new' ? 'list' : 'new')}
              className="h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3"
            >
              {tr('sidebar.new')}
            </button>
          </div>
        </div>
        <button
          type="button"
          title={root ?? tr('sidebar.openFolder')}
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
          <span className="min-w-0 flex-1 truncate">
            {root ? tildePath(root) : tr('sidebar.openFolder')}
          </span>
          {(repos > 0 || isRepo) && (
            <span className="text-[11px] text-fg-muted">
              {tr('sidebar.repos', { n: Math.max(repos, 1) })}
            </span>
          )}
        </button>
      </div>
      {mode === 'new' && <NewTaskForm onDone={() => setMode('list')} />}
      {mode === 'presets' && <PresetEditor onDone={() => setMode('list')} />}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1.5 py-2">
        {empty && (
          <p className="px-2.5 py-4 text-xs leading-normal text-fg-muted">{tr('sidebar.empty')}</p>
        )}
        {GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => (
          <div key={g} className="flex flex-col gap-0.5" role="group" aria-label={groupLabel(g)}>
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
              <span className={`size-2 rounded-full ${GROUP_DOT[g]}`} />
              {groupLabel(g)}
              <span className="ml-auto font-medium">{groups[g].length}</span>
            </div>
            {groups[g].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={tr('central.task', { name: item.name })}
                // Tarefa sem agente não tem cartão na Central: abre a tarefa direto.
                onClick={() =>
                  item.wsTask && item.group === 'idle'
                    ? void openTask(item.wsTask.id)
                    : focusItem(item)
                }
                onContextMenu={(e) => {
                  const items = itemMenu(item)
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
        <HiddenTasks />
      </div>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

// Tarefas escondidas da Central (botão direito → Esconder, ou desmarcadas na descoberta): ficam
// recolhidas no fim da lista, com "Mostrar" para trazer de volta.
function HiddenTasks() {
  const tr = useT()
  const tasks = useTasksStore((s) => (s.workspace?.imported ? s.workspace.tasks : undefined))
  const [open, setOpen] = useState(false)
  const hidden = tasks?.filter((t) => t.hidden) ?? []
  if (hidden.length === 0) return null
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1 text-left text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase hover:text-fg"
      >
        {tr('sidebar.hidden', { n: hidden.length })}
        <span className="ml-auto font-normal normal-case">
          {open ? tr('sidebar.hiddenCollapse') : tr('sidebar.hiddenExpand')}
        </span>
      </button>
      {open &&
        hidden.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-fg-muted"
          >
            <span className="font-geist-mono text-[11px]">{t.key === t.name ? '' : t.key}</span>
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            <button
              type="button"
              aria-label={tr('sidebar.unhideLabel', { name: t.name })}
              onClick={() => void setTaskHidden(t.id, false)}
              className="text-xs hover:text-fg"
            >
              {tr('sidebar.unhide')}
            </button>
          </div>
        ))}
    </div>
  )
}
