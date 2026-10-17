import { DockviewReact, themeAbyss, type DockviewReadyEvent } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { useCallback, useEffect, useRef } from 'react'
import { Welcome } from '../app/Welcome'
import {
  AGENT_TAB_COMPONENT,
  isReviewPanel,
  REVIEW_COMPONENT,
  REVIEW_TAB_COMPONENT,
} from '../features/agents/agents.actions'
import { AgentTab } from '../features/agents/AgentTab'
import { ReviewPanel } from '../features/agents/ReviewPanel'
import { ReviewTab } from '../features/agents/ReviewTab'
import { EDITOR_COMPONENT } from '../features/editor/editor.actions'
import { useEditorStore } from '../features/editor/editor.store'
import { EditorPanel } from '../features/editor/EditorPanel'
import { EditorTab } from '../features/editor/EditorTab'
import { disposeModel } from '../features/editor/models'
import { DiffPanel } from '../features/git/DiffPanel'
import { DiffTab } from '../features/git/DiffTab'
import { DIFF_COMPONENT, isDiffPanel } from '../features/git/git.actions'
import { CreatePullPanel } from '../features/github/CreatePullPanel'
import {
  CREATE_PR_COMPONENT,
  GITHUB_TAB_COMPONENT,
  isGitHubPanel,
  ISSUE_COMPONENT,
  PR_COMPONENT,
} from '../features/github/github.actions'
import { GitHubTab } from '../features/github/GitHubTab'
import { IssuePanel } from '../features/github/IssuePanel'
import { PullPanel } from '../features/github/PullPanel'
import { noteActivePanel, TERMINAL_COMPONENT } from '../features/terminal/terminal.actions'
import { TerminalGroupActions } from '../features/terminal/TerminalGroupActions'
import { TerminalPanel } from '../features/terminal/TerminalPanel'
import { TerminalTab } from '../features/terminal/TerminalTab'
import { disposeSession, isAgentPanel, isTerminalPanel } from '../features/terminal/terminals'
import { DiscoverPanel } from '../features/tasks/DiscoverPanel'
import { DiscoverTab } from '../features/tasks/DiscoverTab'
import { TaskDetails } from '../features/tasks/TaskDetails'
import { TaskReviewPanel } from '../features/tasks/TaskReviewPanel'
import { TaskReviewTab } from '../features/tasks/TaskReviewTab'
import {
  isTaskReviewPanel,
  TASK_REVIEW_COMPONENT,
  TASK_REVIEW_TAB_COMPONENT,
} from '../features/tasks/review.actions'
import {
  DISCOVER_COMPONENT,
  DISCOVER_TAB_COMPONENT,
  isDiscoverPanel,
} from '../features/tasks/tasks.actions'
import { useTasksStore } from '../features/tasks/tasks.store'
import { findPanel, registerDock, unregisterDock, WORKSPACE_CONTEXT } from '../lib/dock'
import { isMac } from '../lib/platform'
import { useContextStore } from '../stores/context.store'

const components = {
  [EDITOR_COMPONENT]: EditorPanel,
  [TERMINAL_COMPONENT]: TerminalPanel,
  [DIFF_COMPONENT]: DiffPanel,
  [PR_COMPONENT]: PullPanel,
  [ISSUE_COMPONENT]: IssuePanel,
  [CREATE_PR_COMPONENT]: CreatePullPanel,
  [REVIEW_COMPONENT]: ReviewPanel,
  [DISCOVER_COMPONENT]: DiscoverPanel,
  [TASK_REVIEW_COMPONENT]: TaskReviewPanel,
}
const tabComponents = {
  [EDITOR_COMPONENT]: EditorTab,
  [TERMINAL_COMPONENT]: TerminalTab,
  [DIFF_COMPONENT]: DiffTab,
  [GITHUB_TAB_COMPONENT]: GitHubTab,
  [AGENT_TAB_COMPONENT]: AgentTab,
  [REVIEW_TAB_COMPONENT]: ReviewTab,
  [DISCOVER_TAB_COMPONENT]: DiscoverTab,
  [TASK_REVIEW_TAB_COMPONENT]: TaskReviewTab,
}

// Painéis de editor são identificados pelo caminho do arquivo; os demais têm prefixo.
function isEditorPanel(id: string): boolean {
  return ![
    isTerminalPanel,
    isAgentPanel,
    isDiffPanel,
    isGitHubPanel,
    isReviewPanel,
    isDiscoverPanel,
    isTaskReviewPanel,
  ].some((is) => is(id))
}

// Um dock por contexto (workspace e cada tarefa aberta). Só o ativo fica visível; os outros
// continuam montados, então abas e terminais de cada tarefa sobrevivem à troca.
export function MainArea() {
  const contexts = useContextStore((s) => s.contexts)
  const active = useContextStore((s) => s.active)
  const taskOpen = useTasksStore((s) => s.activeTaskId !== null)

  return (
    <main className="flex min-w-0 flex-1">
      <div className="relative min-w-0 flex-1">
        {contexts.map((id) => (
          <DockContext key={id} id={id} visible={id === active} />
        ))}
      </div>
      {taskOpen && <TaskDetails />}
    </main>
  )
}

function syncActive(id: string | null): void {
  noteActivePanel(id)
  useEditorStore.getState().setActive(id && isEditorPanel(id) ? id : null)
}

function DockContext({ id, visible }: { id: string; visible: boolean }) {
  const apiRef = useRef<DockviewReadyEvent['api'] | null>(null)
  const onReady = useCallback(
    ({ api }: DockviewReadyEvent) => {
      apiRef.current = api
      registerDock(id, api)
      api.onDidActivePanelChange(({ panel }) => {
        if (useContextStore.getState().active === id) syncActive(panel?.id ?? null)
      })
      // Painel removido por outro caminho: libera o modelo ou o terminal, se nenhum outro
      // contexto ainda o mostra. Mover entre grupos também dispara remoção, então confere
      // depois que o movimento termina.
      api.onDidRemovePanel((panel) => {
        setTimeout(() => {
          if (findPanel(panel.id)) return
          if (isTerminalPanel(panel.id) || isAgentPanel(panel.id)) disposeSession(panel.id)
          else if (isEditorPanel(panel.id)) disposeModel(panel.id)
        }, 0)
      })
    },
    [id],
  )

  // Registra de novo ao remontar: no StrictMode (dev) o efeito roda, limpa e roda outra vez,
  // mas o onReady do dockview só é chamado uma vez.
  useEffect(() => {
    if (apiRef.current) registerDock(id, apiRef.current)
    return () => unregisterDock(id)
  }, [id])
  // Ao virar o contexto ativo, o editor e o terminal "atuais" passam a ser os deste dock.
  useEffect(() => {
    if (visible) syncActive(apiRef.current?.activePanel?.id ?? null)
  }, [visible])

  return (
    <div className="absolute inset-0" data-hidden-context={visible ? undefined : ''}>
      <DockviewReact
        className="kite-dock"
        theme={themeAbyss}
        components={components}
        tabComponents={tabComponents}
        watermarkComponent={id === WORKSPACE_CONTEXT ? Welcome : TaskWatermark}
        rightHeaderActionsComponent={TerminalGroupActions}
        onReady={onReady}
        defaultRenderer="always"
      />
    </div>
  )
}

function TaskWatermark() {
  const mod = isMac ? '⌘' : 'Ctrl+'
  return (
    <div className="flex h-full items-center justify-center font-geist text-fg-muted">
      Abra um arquivo no explorer da tarefa ou use {mod}P para buscar nos repositórios dela.
    </div>
  )
}
