import { THEMES } from '@shared/themes'
import { openFolder, openRecent } from '../../app/workspace.actions'
import { jumpToNextWaiting, openCentral } from '../../features/agents/attention.actions'
import { useAgentsStore } from '../../features/agents/agents.store'
import { useAttentionStore } from '../../features/agents/attention.store'
import { openConnectAgents } from '../../features/agents/sessions.actions'
import { closeActive, saveActive } from '../../features/editor/editor.actions'
import { useQuickOpenStore } from '../../features/quick-open/quick-open.store'
import { openTaskReview } from '../../features/tasks/review.actions'
import { useTaskSwitcherStore } from '../../features/tasks/task-switcher.store'
import { openDiscover, showWorkspace, startAgentInTask } from '../../features/tasks/tasks.actions'
import { useTasksStore } from '../../features/tasks/tasks.store'
import { focusOrCreateTerminal, openTerminal } from '../../features/terminal/terminal.actions'
import { isMac } from '../../lib/platform'
import { VIEWS } from '../../lib/views'
import { useLayoutStore } from '../../stores/layout.store'
import { useThemeStore } from '../../stores/theme.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { tildePath } from '../../features/agents/session-format'

// Menus da barra superior: só ações do Kite (pastas, tarefas, agentes, terminais e visual).
// Os atalhos mostrados são os que o app já trata (use-keybindings.ts).

export type MenuEntry =
  | {
      kind: 'item'
      label: string
      run: () => void
      shortcut?: string
      disabled?: boolean
      checked?: boolean
    }
  | { kind: 'sub'; label: string; items: MenuEntry[]; disabled?: boolean }
  | { kind: 'sep' }

export interface MenuDef {
  id: string
  label: string
  items: MenuEntry[]
}

const mod = isMac ? '⌘' : 'Ctrl+'
const shift = isMac ? '⇧' : 'Shift+'
const REPO_URL = 'https://github.com/WesRamox/AiController'

const item = (
  label: string,
  run: () => void,
  opts: { shortcut?: string; disabled?: boolean; checked?: boolean } = {},
): MenuEntry => ({ kind: 'item', label, run, ...opts })
const sep: MenuEntry = { kind: 'sep' }

function showView(id: (typeof VIEWS)[number]['id']): void {
  const layout = useLayoutStore.getState()
  if (layout.activeView !== id || !layout.sidebarVisible) layout.selectView(id)
}

function newTask(): void {
  showView('attention')
  useAttentionStore.getState().set({ mode: 'new' })
}

async function showAbout(): Promise<void> {
  const res = await window.api.app.getInfo()
  if (!res.ok) return
  const { name, version, versions } = res.data
  await window.api.dialog.confirm({
    message: `${name} ${version}`,
    detail: `IDE para trabalhar com agentes de IA.\n\nElectron ${versions.electron}\nChromium ${versions.chrome}\nNode ${versions.node}`,
    buttons: ['OK'],
  })
}

// Lê o estado na hora de abrir o menu: itens habilitados, recentes, tema atual, tarefa aberta.
export function buildMenus(): MenuDef[] {
  const root = useWorkspaceStore.getState().root
  const recent = useWorkspaceStore.getState().recent.filter((p) => p !== root)
  const layout = useLayoutStore.getState()
  const theme = useThemeStore.getState().theme
  const tasks = useTasksStore.getState()
  const activeTask = tasks.activeTaskId
  const presets = useAgentsStore.getState().presets.filter((p) => p.command.trim())

  return [
    {
      id: 'file',
      label: 'Arquivo',
      items: [
        item('Abrir pasta…', () => void openFolder()),
        {
          kind: 'sub',
          label: 'Abrir recente',
          disabled: recent.length === 0,
          items: recent.slice(0, 10).map((p) => item(tildePath(p), () => void openRecent(p))),
        },
        sep,
        item('Abrir arquivo…', () => useQuickOpenStore.getState().show(), {
          shortcut: `${mod}P`,
          disabled: !root,
        }),
        item('Salvar', () => void saveActive(), { shortcut: `${mod}S`, disabled: !root }),
        item('Fechar aba', () => void closeActive(), { shortcut: `${mod}W`, disabled: !root }),
        sep,
        item('Sair', () => window.close(), { shortcut: isMac ? '⌘Q' : undefined }),
      ],
    },
    {
      id: 'view',
      label: 'Ver',
      items: [
        ...VIEWS.map((v) =>
          item(v.label, () => showView(v.id), {
            checked: layout.sidebarVisible && layout.activeView === v.id,
          }),
        ),
        sep,
        item(
          layout.sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral',
          () => useLayoutStore.getState().toggleSidebar(),
          { shortcut: `${mod}B` },
        ),
        item('Abrir Central na área principal', openCentral, { disabled: !root }),
        sep,
        {
          kind: 'sub',
          label: 'Tema',
          items: THEMES.map((t) =>
            item(t.label, () => useThemeStore.getState().setTheme(t.id), {
              checked: theme === t.id,
            }),
          ),
        },
      ],
    },
    {
      id: 'task',
      label: 'Tarefa',
      items: [
        item('Nova tarefa…', newTask, { disabled: !root }),
        item('Trocar de tarefa…', () => useTaskSwitcherStore.getState().show(), {
          shortcut: `${mod}K`,
          disabled: !tasks.workspace,
        }),
        item('Descobrir tarefas…', openDiscover, { disabled: !root }),
        sep,
        item('Revisar mudanças da tarefa', () => activeTask && void openTaskReview(activeTask), {
          disabled: !activeTask,
        }),
        item('Voltar ao workspace', showWorkspace, { disabled: !activeTask }),
        sep,
        item('Próximo agente esperando', jumpToNextWaiting, { shortcut: `${mod}J` }),
      ],
    },
    {
      id: 'terminal',
      label: 'Terminal',
      items: [
        item('Novo terminal', () => void openTerminal(), {
          shortcut: `${mod}${shift}\``,
          disabled: !root,
        }),
        item('Ir para o terminal', focusOrCreateTerminal, {
          shortcut: `${mod}\``,
          disabled: !root,
        }),
        {
          kind: 'sub',
          label: 'Novo agente na tarefa',
          disabled: !activeTask || presets.length === 0,
          items: presets.map((p) =>
            item(p.name, () => activeTask && void startAgentInTask(activeTask, p.id)),
          ),
        },
        sep,
        item('Conectar agentes…', openConnectAgents),
      ],
    },
    {
      id: 'help',
      label: 'Ajuda',
      items: [
        item('Documentação', () => window.open(`${REPO_URL}#readme`, '_blank')),
        item('Relatar um problema', () => window.open(`${REPO_URL}/issues/new`, '_blank')),
        sep,
        item('Sobre o Kite', () => void showAbout()),
      ],
    },
  ]
}
