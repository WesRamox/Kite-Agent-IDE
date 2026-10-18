import { ChevronDown, GitCompare, Play, Send, SquareTerminal } from 'lucide-react'
import { useState } from 'react'
import type { AgentPreset, Task } from '@shared/types'
import { useAgentsStore } from '../features/agents/agents.store'
import { requestDeliver, openTaskReview } from '../features/tasks/review.actions'
import { startAgentInTask } from '../features/tasks/tasks.actions'
import { useActiveTask, useTasksStore } from '../features/tasks/tasks.store'
import { useTaskSwitcherStore } from '../features/tasks/task-switcher.store'
import { TaskDot } from '../features/tasks/TaskDot'
import { openTerminal } from '../features/terminal/terminal.actions'
import { basename } from '../lib/paths'
import { isMac } from '../lib/platform'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useT } from '../lib/i18n'
import { ContextMenu, type MenuItem } from './ContextMenu'

// Barra de ações no topo da área principal: o que se faz com mais frequência na tarefa aberta
// (ou no workspace), sem ir aos menus. Desvio do canvas combinado com o usuário.

const BTN =
  'flex h-[26px] items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3'
const PRIMARY =
  'flex h-[26px] items-center gap-1.5 rounded-l-md bg-accent px-2.5 text-xs font-semibold text-accent-fg hover:bg-accent/85'
const PRIMARY_CARET =
  'flex h-[26px] items-center rounded-r-md border-l border-accent-fg/20 bg-accent px-1.5 text-accent-fg hover:bg-accent/85'

type Menu = { x: number; y: number; items: MenuItem[] } | null

const runnable = (presets: AgentPreset[]) => presets.filter((p) => p.command.trim())

export function ContextBar() {
  const root = useWorkspaceStore((s) => s.root)
  const task = useActiveTask()
  const [menu, setMenu] = useState<Menu>(null)
  if (!root) return null
  const open = (e: React.MouseEvent, items: MenuItem[]) =>
    setMenu({
      x: e.currentTarget.getBoundingClientRect().left,
      y: e.currentTarget.getBoundingClientRect().bottom + 4,
      items,
    })

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-3 font-geist">
      {task ? (
        <TaskActions task={task} onMenu={open} />
      ) : (
        <WorkspaceActions root={root} onMenu={open} />
      )}
      {menu && menu.items.length > 0 && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}

type OnMenu = (e: React.MouseEvent, items: MenuItem[]) => void

function AgentButton(props: {
  label: (agent: string) => string
  onRun: (p: AgentPreset) => void
  onMenu: OnMenu
}) {
  const t = useT()
  const presets = runnable(useAgentsStore((s) => s.presets))
  const first = presets[0]
  if (!first) return null
  return (
    <div className="flex">
      <button type="button" onClick={() => props.onRun(first)} className={PRIMARY}>
        <Play size={12} /> {props.label(first.name)}
      </button>
      <button
        type="button"
        aria-label={t('bar.chooseAgent')}
        onClick={(e) =>
          props.onMenu(
            e,
            presets.map((p) => ({ label: p.name, onSelect: () => props.onRun(p) })),
          )
        }
        className={PRIMARY_CARET}
      >
        <ChevronDown size={12} />
      </button>
    </div>
  )
}

function TaskActions({ task, onMenu }: { task: Task; onMenu: OnMenu }) {
  const t = useT()
  const terminalTargets: MenuItem[] = [
    ...(task.folder
      ? [
          {
            label: t('bar.taskFolder'),
            onSelect: () => openTerminal({ cwd: task.folder ?? undefined }),
          },
        ]
      : []),
    ...task.worktrees.map((w) => ({
      label: w.repoName,
      onSelect: () => openTerminal({ cwd: w.path, title: w.repoName }),
    })),
  ]
  return (
    <>
      <TaskDot taskId={task.id} />
      <span className="font-geist-mono text-[11px] text-fg-muted">{task.key}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-fg">
        {task.name === task.key ? '' : task.name}
      </span>
      <AgentButton
        label={(agent) => agent}
        onRun={(p) => void startAgentInTask(task.id, p.id)}
        onMenu={onMenu}
      />
      <div className="flex">
        <button
          type="button"
          onClick={() => openTerminal()}
          className={`${BTN} rounded-r-none border-r-0`}
        >
          <SquareTerminal size={13} /> {t('bar.terminal')}
        </button>
        <button
          type="button"
          aria-label={t('bar.terminalIn')}
          onClick={(e) => onMenu(e, terminalTargets)}
          className={`${BTN} rounded-l-none px-1.5`}
        >
          <ChevronDown size={12} />
        </button>
      </div>
      <button type="button" onClick={() => void openTaskReview(task.id)} className={BTN}>
        <GitCompare size={13} /> {t('bar.review')}
      </button>
      <button type="button" onClick={() => void requestDeliver(task.id)} className={BTN}>
        <Send size={13} /> {t('bar.deliver')}
      </button>
    </>
  )
}

function WorkspaceActions({ root, onMenu }: { root: string; onMenu: OnMenu }) {
  const t = useT()
  const hasTasks = useTasksStore((s) => (s.workspace?.tasks.length ?? 0) > 0)
  const mod = isMac ? '⌘' : 'Ctrl+'
  return (
    <>
      <span className="size-2 shrink-0 rounded-full bg-fg-muted/50" />
      <span className="font-geist-mono text-[11px] text-fg-muted">
        {t('workspaceSwitcher.label')}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-fg">{basename(root)}</span>
      {/* Agente na raiz do workspace, num terminal comum: quando ele criar as worktrees de uma
          tarefa, a sessão é ligada a ela pelos hooks. */}
      <AgentButton
        label={(agent) => t('bar.agentHere', { agent })}
        onRun={(p) => openTerminal({ cwd: root, input: p.command, title: p.name })}
        onMenu={onMenu}
      />
      <button type="button" onClick={() => openTerminal({ cwd: root })} className={BTN}>
        <SquareTerminal size={13} /> {t('bar.terminal')}
      </button>
      {hasTasks && (
        <button
          type="button"
          onClick={() => useTaskSwitcherStore.getState().show()}
          className={BTN}
        >
          {t('bar.chooseTask')}
          <span className="font-geist-mono text-[10px] text-fg-muted">{mod}K</span>
        </button>
      )}
    </>
  )
}
