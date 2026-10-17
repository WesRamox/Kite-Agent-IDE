import { DockviewReact, themeAbyss, type DockviewReadyEvent } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { useCallback } from 'react'
import { Welcome } from '../app/Welcome'
import {
  AGENT_TAB_COMPONENT,
  isReviewPanel,
  REVIEW_COMPONENT,
  REVIEW_TAB_COMPONENT,
} from '../features/agents/agents.actions'
import { AgentTab } from '../features/agents/AgentTab'
import {
  ATTENTION_COMPONENT,
  ATTENTION_TAB_COMPONENT,
  isAttentionPanel,
} from '../features/agents/attention.actions'
import { AttentionTab } from '../features/agents/AttentionTab'
import { CentralPanel } from '../features/agents/CentralPanel'
import { ConnectAgentsPanel } from '../features/agents/ConnectAgentsPanel'
import { ConnectAgentsTab } from '../features/agents/ConnectAgentsTab'
import {
  CONNECT_COMPONENT,
  CONNECT_TAB_COMPONENT,
  isConnectPanel,
} from '../features/agents/sessions.actions'
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
import { setDockApi } from '../lib/dock'

const components = {
  [EDITOR_COMPONENT]: EditorPanel,
  [TERMINAL_COMPONENT]: TerminalPanel,
  [DIFF_COMPONENT]: DiffPanel,
  [PR_COMPONENT]: PullPanel,
  [ISSUE_COMPONENT]: IssuePanel,
  [CREATE_PR_COMPONENT]: CreatePullPanel,
  [REVIEW_COMPONENT]: ReviewPanel,
  [CONNECT_COMPONENT]: ConnectAgentsPanel,
  [ATTENTION_COMPONENT]: CentralPanel,
}
const tabComponents = {
  [EDITOR_COMPONENT]: EditorTab,
  [TERMINAL_COMPONENT]: TerminalTab,
  [DIFF_COMPONENT]: DiffTab,
  [GITHUB_TAB_COMPONENT]: GitHubTab,
  [AGENT_TAB_COMPONENT]: AgentTab,
  [REVIEW_TAB_COMPONENT]: ReviewTab,
  [CONNECT_TAB_COMPONENT]: ConnectAgentsTab,
  [ATTENTION_TAB_COMPONENT]: AttentionTab,
}

// Painéis de editor são identificados pelo caminho do arquivo; os demais têm prefixo.
function isEditorPanel(id: string): boolean {
  return ![
    isTerminalPanel,
    isAgentPanel,
    isDiffPanel,
    isGitHubPanel,
    isReviewPanel,
    isConnectPanel,
    isAttentionPanel,
  ].some((is) => is(id))
}

export function MainArea() {
  const onReady = useCallback(({ api }: DockviewReadyEvent) => {
    setDockApi(api)
    api.onDidActivePanelChange(({ panel }) => {
      const id = panel?.id ?? null
      noteActivePanel(id)
      useEditorStore.getState().setActive(id && isEditorPanel(id) ? id : null)
    })
    // Painel removido por outro caminho: libera o modelo. Mover entre grupos também dispara
    // remoção, então confere depois que o movimento termina.
    api.onDidRemovePanel((panel) => {
      setTimeout(() => {
        if (api.getPanel(panel.id)) return
        if (isTerminalPanel(panel.id) || isAgentPanel(panel.id)) disposeSession(panel.id)
        else if (isEditorPanel(panel.id)) disposeModel(panel.id)
      }, 0)
    })
  }, [])

  return (
    <main className="min-w-0 flex-1">
      <DockviewReact
        className="kite-dock"
        theme={themeAbyss}
        components={components}
        tabComponents={tabComponents}
        watermarkComponent={Welcome}
        rightHeaderActionsComponent={TerminalGroupActions}
        onReady={onReady}
        defaultRenderer="always"
      />
    </main>
  )
}
