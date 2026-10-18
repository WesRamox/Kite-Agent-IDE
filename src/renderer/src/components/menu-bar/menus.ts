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
import { tildePath } from '../../lib/session-format'
import { openSettings } from '../../features/settings/settings.actions'
import type { TFunction } from '@shared/i18n'
import { t as currentT } from '../../lib/i18n'

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
const REPO_URL = 'https://github.com/WesRamox/Kite-Agent-IDE'

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
    detail: currentT('menu.aboutDetail', {
      electron: versions.electron,
      chrome: versions.chrome,
      node: versions.node,
    }),
    buttons: [currentT('menu.ok')],
  })
}

// Lê o estado na hora de abrir o menu: itens habilitados, recentes, tema atual, tarefa aberta.
// Lê o estado na hora (habilitados, recentes, tema): chame ao abrir o menu.
export function buildMenus(t: TFunction = currentT): MenuDef[] {
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
      label: t('menu.file'),
      items: [
        item(t('menu.openFolder'), () => void openFolder()),
        {
          kind: 'sub',
          label: t('menu.openRecent'),
          disabled: recent.length === 0,
          items: recent.slice(0, 10).map((p) => item(tildePath(p), () => void openRecent(p))),
        },
        sep,
        item(t('menu.openFile'), () => useQuickOpenStore.getState().show(), {
          shortcut: `${mod}P`,
          disabled: !root,
        }),
        item(t('menu.save'), () => void saveActive(), { shortcut: `${mod}S`, disabled: !root }),
        item(t('menu.closeTab'), () => void closeActive(), {
          shortcut: `${mod}W`,
          disabled: !root,
        }),
        sep,
        item(t('menu.settings'), openSettings, { shortcut: `${mod},` }),
        sep,
        item(t('menu.quit'), () => window.close(), { shortcut: isMac ? '⌘Q' : undefined }),
      ],
    },
    {
      id: 'view',
      label: t('menu.view'),
      items: [
        ...VIEWS.map((v) =>
          item(t(v.label), () => showView(v.id), {
            checked: layout.sidebarVisible && layout.activeView === v.id,
          }),
        ),
        sep,
        item(
          layout.sidebarVisible ? t('menu.hideSidebar') : t('menu.showSidebar'),
          () => useLayoutStore.getState().toggleSidebar(),
          { shortcut: `${mod}B` },
        ),
        item(t('menu.openCentral'), openCentral),
        sep,
        {
          kind: 'sub',
          label: t('menu.theme'),
          items: THEMES.map((th) =>
            item(t(`theme.${th.id}`), () => useThemeStore.getState().setTheme(th.id), {
              checked: theme === th.id,
            }),
          ),
        },
      ],
    },
    {
      id: 'task',
      label: t('menu.task'),
      items: [
        item(t('menu.newTask'), newTask, { disabled: !root }),
        item(t('menu.switchTask'), () => useTaskSwitcherStore.getState().show(), {
          shortcut: `${mod}K`,
          disabled: !tasks.workspace,
        }),
        item(t('menu.discover'), openDiscover, { disabled: !root }),
        sep,
        item(t('menu.reviewTask'), () => activeTask && void openTaskReview(activeTask), {
          disabled: !activeTask,
        }),
        item(t('menu.backToWorkspace'), showWorkspace, { disabled: !activeTask }),
        sep,
        item(t('menu.nextWaiting'), jumpToNextWaiting, { shortcut: `${mod}J` }),
      ],
    },
    {
      id: 'terminal',
      label: t('menu.terminal'),
      items: [
        item(t('menu.newTerminal'), () => void openTerminal(), {
          shortcut: `${mod}${shift}\``,
          disabled: !root,
        }),
        item(t('menu.goToTerminal'), focusOrCreateTerminal, {
          shortcut: `${mod}\``,
          disabled: !root,
        }),
        {
          kind: 'sub',
          label: t('menu.newAgentInTask'),
          disabled: !activeTask || presets.length === 0,
          items: presets.map((p) =>
            item(p.name, () => activeTask && void startAgentInTask(activeTask, p.id)),
          ),
        },
        sep,
        item(t('menu.connectAgents'), openConnectAgents),
      ],
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        item(t('menu.docs'), () => window.open(`${REPO_URL}#readme`, '_blank')),
        item(t('menu.reportIssue'), () => window.open(`${REPO_URL}/issues/new`, '_blank')),
        sep,
        item(t('menu.about'), () => void showAbout()),
      ],
    },
  ]
}
