import type { AgentCli, AgentSession, HooksStatus } from '@shared/types'
import { useState } from 'react'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { linkSessions } from '../../lib/task-links'
import { linkSession } from '../tasks/tasks.actions'
import { useTasksStore } from '../tasks/tasks.store'
import { openAgentTerminal } from './agents.actions'
import { CLI_LABEL, CLI_SHORT, CLIS } from '../../lib/agent-cli'
import { showAttentionView } from './attention.actions'
import { useAttentionStore } from './attention.store'
import { useAgentsStore } from './agents.store'
import {
  sessionEvidence,
  sessionStatusLabel,
  sessionTone,
  tildePath,
  type SessionTone,
} from '../../lib/session-format'
import { installHooks, uninstallHooks } from './sessions.actions'
import { useSessionsStore } from './sessions.store'
import { useT } from '../../lib/i18n'

// Tela 5 do canvas "Kite — Tarefas multi-repo" (Hooks.dc.html).

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'
const BTN =
  'h-[30px] rounded-[7px] px-3 font-medium disabled:cursor-not-allowed disabled:opacity-50'
const BTN_PRIMARY = `${BTN} bg-accent text-accent-fg hover:bg-accent/85`
const BTN_SECONDARY = `${BTN} border border-border bg-surface-2 text-fg hover:bg-surface-3`
const BTN_SMALL =
  'h-[26px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50'

const TONE_TEXT: Record<SessionTone, string> = {
  waiting: 'text-accent',
  running: 'text-info',
  muted: 'text-fg-muted',
}
const TONE_DOT: Record<SessionTone, string> = {
  waiting: 'bg-accent',
  running: 'bg-info',
  muted: 'bg-fg-muted/50',
}

export function ConnectAgentsPanel() {
  const hooks = useSessionsStore((s) => s.hooks)
  // CLI cujo arquivo aparece em "O que muda": o último em que você mexeu.
  const [preview, setPreview] = useState<AgentCli>('claude')
  const all = useSessionsStore((s) => s.sessions)
  const sessions = all.filter((x) => x.status !== 'ended')
  const tr = useT()

  return (
    <div className="h-full overflow-y-auto bg-surface-0 font-geist text-[13px] text-fg">
      <div className="flex min-h-full justify-center px-6 py-9">
        <div className="flex w-full max-w-[1120px] flex-col gap-6">
          <header>
            <span className={LABEL}>{tr('connect.kicker')}</span>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
              {tr('connect.title')}
            </h1>
            <p className="mt-2 max-w-[720px] leading-normal text-fg-muted">{tr('connect.intro')}</p>
          </header>

          <div className="flex flex-wrap items-start gap-6">
            <section
              aria-label={tr('connect.integrations')}
              className="flex flex-[1_1_420px] flex-col gap-2.5"
            >
              {CLIS.map((cli) => (
                <HookCard
                  key={cli}
                  cli={cli}
                  hooks={hooks[cli] ?? null}
                  onTouch={() => setPreview(cli)}
                />
              ))}
              <CliCard
                name={tr('connect.otherClis')}
                how={tr('connect.otherClisHow')}
                state={tr('connect.alwaysOn')}
                action={tr('connect.adjust')}
                onAction={() => {
                  useAttentionStore.getState().set({ mode: 'presets' })
                  showAttentionView()
                }}
              />
              {hooks[preview] && (
                <SettingsPreview hooks={hooks[preview]} cli={preview} onPick={setPreview} />
              )}
            </section>

            <section
              aria-label={tr('connect.sessions')}
              className="flex flex-[1_1_420px] flex-col gap-2.5"
            >
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-semibold">{tr('connect.activeSessions')}</h2>
                <span className="text-xs text-fg-muted">{tr('connect.activeSessionsHint')}</span>
              </div>
              {sessions.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-xs leading-[1.45] text-fg-muted">
                  {tr('connect.noSessions')}
                </p>
              ) : (
                sessions.map((s) => <SessionCard key={s.id} session={s} />)
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function CliCard(props: {
  name: string
  how: string
  state: string
  stateClass?: string
  action: string
  primary?: boolean
  active?: boolean
  disabled?: boolean
  onAction?: () => void
}) {
  const tr = useT()
  return (
    <div
      role="group"
      aria-label={props.name}
      className={`flex flex-wrap items-center gap-3 rounded-[10px] border bg-surface-1 px-4 py-3.5 ${
        props.active ? 'border-accent/20' : 'border-border'
      }`}
    >
      <div className="flex flex-[1_1_240px] flex-col gap-1">
        <span className="font-semibold">{props.name}</span>
        <span className="text-xs leading-[1.45] text-fg-muted">{props.how}</span>
      </div>
      <span className={`text-xs ${props.stateClass ?? 'text-fg-muted'}`}>{props.state}</span>
      <button
        type="button"
        disabled={props.disabled}
        title={props.disabled ? tr('connect.nextPhase') : undefined}
        onClick={props.onAction}
        className={props.primary ? BTN_PRIMARY : BTN_SECONDARY}
      >
        {props.action}
      </button>
    </div>
  )
}

function HookCard(props: { cli: AgentCli; hooks: HooksStatus | null; onTouch: () => void }) {
  const { cli, hooks } = props
  const name = CLI_LABEL[cli]
  const tr = useT()
  const how = tr(`connect.how.${cli}`)
  const act = (fn: () => Promise<void>) => {
    props.onTouch()
    void fn()
  }
  if (hooks?.error) {
    return (
      <CliCard
        name={name}
        how={how}
        state={tr('connect.invalid')}
        stateClass="text-danger"
        action={tr('connect.retry')}
        onAction={() => act(() => installHooks(cli))}
      />
    )
  }
  const installed = hooks?.installed ?? false
  return (
    <CliCard
      name={name}
      how={how}
      state={installed ? tr('connect.connected') : tr('connect.notConnected')}
      stateClass={installed ? 'text-success' : 'text-fg-muted'}
      action={installed ? tr('connect.remove') : tr('connect.connect')}
      primary={!installed}
      active={installed}
      disabled={!hooks}
      onAction={() => act(() => (installed ? uninstallHooks(cli) : installHooks(cli)))}
    />
  )
}

function SettingsPreview(props: {
  hooks: HooksStatus
  cli: AgentCli
  onPick: (cli: AgentCli) => void
}) {
  const { hooks } = props
  const tr = useT()
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>{tr('connect.whatChanges', { path: hooks.settingsPath })}</span>
        <span className="flex-1" />
        <div role="group" aria-label={tr('connect.viewFileOf')} className="flex gap-1">
          {CLIS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === props.cli}
              onClick={() => props.onPick(c)}
              className={`h-6 rounded-md px-2 text-[11px] ${
                c === props.cli ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {CLI_SHORT[c]}
            </button>
          ))}
        </div>
      </div>
      <pre className="m-0 whitespace-pre-wrap rounded-lg border border-border bg-surface-0 p-3 font-geist-mono text-xs leading-[1.55] text-fg/80">
        {hooks.snippet}
      </pre>
      <p className="text-xs leading-normal text-fg-muted">
        {hooks.error ? tr('connect.cannotRead', { error: hooks.error }) : tr('connect.privacy')}
      </p>
    </div>
  )
}

function SessionCard({ session }: { session: AgentSession }) {
  const tone = sessionTone(session)
  const tr = useT()
  const task = useAgentsStore((s) =>
    session.agentTaskId ? s.tasks.find((t) => t.id === session.agentTaskId) : undefined,
  )
  const ws = useTasksStore((s) => s.workspace)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const visible = ws?.imported ? ws.tasks.filter((t) => !t.hidden) : []
  const linkedId = linkSessions([session], visible, ws?.sessionLinks ?? {}).get(session.id)
  const linked = visible.find((t) => t.id === linkedId)
  const manual = ws?.sessionLinks[session.id] === linkedId
  const startedInside =
    linked &&
    !manual &&
    [linked.folder, ...linked.worktrees.map((w) => w.path)].some(
      (d) => d && (session.cwd === d || session.cwd.startsWith(`${d}/`)),
    )
  const evidence =
    startedInside && session.touchedCount === 0
      ? tr('connect.startedInside')
      : sessionEvidence(session)

  const openMenu = (e: React.MouseEvent) =>
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        ...visible.map((t) => ({
          label: `${t.key} · ${t.name}`,
          onSelect: () => void linkSession(session.id, t.id),
        })),
        ...(manual
          ? [
              {
                label: tr('connect.backToAuto'),
                onSelect: () => void linkSession(session.id, null),
              },
            ]
          : []),
      ],
    })

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`size-2 rounded-full ${TONE_DOT[tone]}`} />
        <span className="font-medium">{CLI_LABEL[session.cli]}</span>
        <span className="font-geist-mono text-xs text-fg-muted">{tildePath(session.cwd)}</span>
        <span className={`ml-auto text-xs ${TONE_TEXT[tone]}`}>{sessionStatusLabel(session)}</span>
      </div>
      <div className="text-xs leading-[1.45] text-fg-muted">{evidence}</div>
      <div className="flex flex-wrap items-center gap-2">
        {task ? (
          <span className="text-xs text-fg">{tr('connect.openedByKite', { name: task.name })}</span>
        ) : linked ? (
          <span className="text-xs text-fg">
            {manual
              ? tr('connect.linkedTo', { key: linked.key })
              : tr('connect.linkedAuto', { key: linked.key })}
          </span>
        ) : (
          <span className="text-xs text-accent">{tr('connect.noTask')}</span>
        )}
        <span className="flex-1" />
        {task ? (
          <button type="button" onClick={() => openAgentTerminal(task.id)} className={BTN_SMALL}>
            {tr('connect.openTerminal')}
          </button>
        ) : (
          <button
            type="button"
            disabled={visible.length === 0}
            title={visible.length === 0 ? tr('connect.needsTasks') : undefined}
            onClick={openMenu}
            className={BTN_SMALL}
          >
            {linked ? tr('connect.switchTask') : tr('connect.linkTo')}
          </button>
        )}
      </div>
      {menu && menu.items.length > 0 && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
