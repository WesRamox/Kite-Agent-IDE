import type { AgentSession, HooksStatus } from '@shared/types'
import { useLayoutStore } from '../../stores/layout.store'
import { openAgentTerminal } from './agents.actions'
import { useAgentsStore } from './agents.store'
import {
  sessionEvidence,
  sessionStatusLabel,
  sessionTone,
  tildePath,
  type SessionTone,
} from './session-format'
import { installHooks, uninstallHooks } from './sessions.actions'
import { useSessionsStore } from './sessions.store'

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
  const all = useSessionsStore((s) => s.sessions)
  const sessions = all.filter((x) => x.status !== 'ended')

  return (
    <div className="h-full overflow-y-auto bg-surface-0 font-geist text-[13px] text-fg">
      <div className="flex min-h-full justify-center px-6 py-9">
        <div className="flex w-full max-w-[1120px] flex-col gap-6">
          <header>
            <span className={LABEL}>Configurações · Agentes</span>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
              Saber quando um agente precisa de você
            </h1>
            <p className="mt-2 max-w-[720px] leading-normal text-fg-muted">
              Com a integração ligada, o próprio agente avisa o Kite quando para, pede permissão ou
              termina, mesmo rodando num terminal fora do Kite. Sem ela, o Kite só consegue
              adivinhar pelo terminal, e só nos agentes abertos aqui dentro.
            </p>
          </header>

          <div className="flex flex-wrap items-start gap-6">
            <section aria-label="Integrações" className="flex flex-[1_1_420px] flex-col gap-2.5">
              <ClaudeCard hooks={hooks} />
              <CliCard
                name="Codex CLI"
                how="Comando de notificação do Codex: avisa quando termina o turno."
                state="Em breve"
                action="Conectar"
                disabled
              />
              <CliCard
                name="Gemini CLI"
                how="Hooks do Gemini CLI, quando disponíveis na versão instalada."
                state="Em breve"
                action="Conectar"
                disabled
              />
              <CliCard
                name="Outros CLIs"
                how="Heurística pelo terminal: só para agentes abertos dentro do Kite."
                state="Sempre ativo"
                action="Ajustar"
                onAction={() => useLayoutStore.getState().selectView('agents')}
              />
              {hooks && <SettingsPreview hooks={hooks} />}
            </section>

            <section
              aria-label="Sessões detectadas"
              className="flex flex-[1_1_420px] flex-col gap-2.5"
            >
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-semibold">Sessões ativas agora</h2>
                <span className="text-xs text-fg-muted">
                  o Kite descobre a tarefa pelos arquivos que o agente toca
                </span>
              </div>
              {sessions.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-xs leading-[1.45] text-fg-muted">
                  Nenhuma sessão ainda. Depois de conectar, abra o Claude Code em qualquer terminal
                  e ela aparece aqui.
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
  return (
    <div
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
        title={props.disabled ? 'Disponível numa próxima fase' : undefined}
        onClick={props.onAction}
        className={props.primary ? BTN_PRIMARY : BTN_SECONDARY}
      >
        {props.action}
      </button>
    </div>
  )
}

function ClaudeCard({ hooks }: { hooks: HooksStatus | null }) {
  const how = 'Hooks: pede permissão, terminou o turno, voltou a trabalhar, arquivos tocados.'
  if (hooks?.error) {
    return (
      <CliCard
        name="Claude Code"
        how={how}
        state="settings.json inválido"
        stateClass="text-danger"
        action="Tentar de novo"
        onAction={() => void installHooks()}
      />
    )
  }
  const installed = hooks?.installed ?? false
  return (
    <CliCard
      name="Claude Code"
      how={how}
      state={installed ? 'Conectado' : 'Não conectado'}
      stateClass={installed ? 'text-success' : 'text-fg-muted'}
      action={installed ? 'Remover' : 'Conectar'}
      primary={!installed}
      active={installed}
      disabled={!hooks}
      onAction={() => void (installed ? uninstallHooks() : installHooks())}
    />
  )
}

function SettingsPreview({ hooks }: { hooks: HooksStatus }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
      <span className={LABEL}>O que muda no {hooks.settingsPath}</span>
      <pre className="m-0 whitespace-pre-wrap rounded-lg border border-border bg-surface-0 p-3 font-geist-mono text-xs leading-[1.55] text-fg/80">
        {hooks.snippet}
      </pre>
      <p className="text-xs leading-normal text-fg-muted">
        {hooks.error
          ? `Não foi possível ler o arquivo: ${hooks.error}. O Kite não altera um settings.json inválido.`
          : 'Seus hooks atuais são mantidos. Os eventos ficam só na sua máquina: o Kite guarda caminhos de arquivo e a última mensagem do agente, nunca o conteúdo dos arquivos. Dá para remover em um clique.'}
      </p>
    </div>
  )
}

function SessionCard({ session }: { session: AgentSession }) {
  const tone = sessionTone(session)
  const task = useAgentsStore((s) =>
    session.agentTaskId ? s.tasks.find((t) => t.id === session.agentTaskId) : undefined,
  )
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`size-2 rounded-full ${TONE_DOT[tone]}`} />
        <span className="font-medium">Claude Code</span>
        <span className="font-geist-mono text-xs text-fg-muted">{tildePath(session.cwd)}</span>
        <span className={`ml-auto text-xs ${TONE_TEXT[tone]}`}>{sessionStatusLabel(session)}</span>
      </div>
      <div className="text-xs leading-[1.45] text-fg-muted">{sessionEvidence(session)}</div>
      <div className="flex flex-wrap items-center gap-2">
        {task ? (
          <span className="text-xs text-fg">Aberta pelo Kite · {task.name}</span>
        ) : (
          <span className="text-xs text-accent">Sem tarefa por enquanto</span>
        )}
        <span className="flex-1" />
        {task ? (
          <button type="button" onClick={() => openAgentTerminal(task.id)} className={BTN_SMALL}>
            Abrir terminal
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Disponível com as tarefas multi-repo"
            className={BTN_SMALL}
          >
            Vincular a…
          </button>
        )}
      </div>
    </div>
  )
}
