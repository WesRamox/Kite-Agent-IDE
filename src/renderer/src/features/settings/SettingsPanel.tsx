import { FONT_MAX, FONT_MIN } from '@shared/settings'
import { THEMES } from '@shared/themes'
import type { AppInfo } from '@shared/types'
import { Check, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLayoutStore } from '../../stores/layout.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useThemeStore } from '../../stores/theme.store'
import { showAttentionView } from '../agents/attention.actions'
import { useAttentionStore } from '../agents/attention.store'
import { CLI_LABEL, CLIS } from '../agents/cli'
import { openConnectAgents } from '../agents/sessions.actions'
import { useSessionsStore } from '../agents/sessions.store'
import { login, logout } from '../github/github.actions'
import { useGitHubStore } from '../github/github.store'
import { GroupingFieldset } from '../tasks/GroupingFieldset'
import { useTasksStore } from '../tasks/tasks.store'

// Página de configurações: aparência, idioma, editor e terminal, agentes, tarefas, GitHub e sobre.
// Mesmo visual das telas de configuração do canvas (Hooks.dc.html): cards em surface-1.

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'
const BTN =
  'h-[30px] shrink-0 rounded-[7px] border border-border bg-surface-2 px-3 font-medium text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50'
const REPO_URL = 'https://github.com/WesRamox/Kite-Agent-IDE'

const SECTIONS = [
  { id: 'appearance', label: 'Aparência' },
  { id: 'language', label: 'Idioma' },
  { id: 'editor', label: 'Editor e terminal' },
  { id: 'agents', label: 'Agentes e notificações' },
  { id: 'tasks', label: 'Tarefas' },
  { id: 'github', label: 'GitHub' },
  { id: 'about', label: 'Sobre' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function Section({ id, title, children }: { id: SectionId; title: string; children: ReactNode }) {
  return (
    <section id={`settings-${id}`} aria-label={title} className="flex scroll-mt-6 flex-col gap-2.5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

// Linha de um card: título e explicação à esquerda, controle à direita.
function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <span className="font-medium">{title}</span>
        {hint && <span className="text-xs leading-[1.45] text-fg-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] border border-border bg-surface-1">{children}</div>
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-surface-3'
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-fg transition-[left] ${
          checked ? 'left-[18px] bg-accent-fg' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function FontStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const btn =
    'flex size-[30px] items-center justify-center text-fg-muted hover:bg-surface-3 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center overflow-hidden rounded-[7px] border border-border bg-surface-0"
    >
      <button
        type="button"
        aria-label={`Diminuir ${label.toLowerCase()}`}
        disabled={value <= FONT_MIN}
        onClick={() => onChange(value - 1)}
        className={btn}
      >
        <Minus size={13} />
      </button>
      <span className="w-14 text-center font-geist-mono text-xs" aria-live="polite">
        {value} px
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${label.toLowerCase()}`}
        disabled={value >= FONT_MAX}
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

function Appearance() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5"
    >
      {THEMES.map((t) => {
        const active = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col overflow-hidden rounded-[10px] border text-left transition-colors ${
              active ? 'border-accent' : 'border-border hover:border-fg-muted/40'
            }`}
          >
            {/* Miniatura: fundo do tema, uma "barra lateral" e linhas de código nas cores dele. */}
            <span className="flex h-[72px] gap-1.5 p-2" style={{ background: t.background }}>
              <span className="w-5 rounded-sm opacity-80" style={{ background: t.swatches[1] }} />
              <span className="flex flex-1 flex-col justify-center gap-1.5">
                <span className="h-1.5 w-3/4 rounded-full" style={{ background: t.swatches[2] }} />
                <span
                  className="h-1.5 w-1/2 rounded-full opacity-70"
                  style={{ background: t.swatches[1] }}
                />
                <span className="h-1.5 w-2/3 rounded-full" style={{ background: t.swatches[2] }} />
              </span>
            </span>
            <span className="flex items-center gap-2 bg-surface-1 px-3 py-2">
              <span className="flex-1 truncate">{t.label}</span>
              {active && <Check size={14} className="text-accent" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Language() {
  const language = useSettingsStore((s) => s.settings.language)
  const options = [
    { id: 'pt-BR', label: 'Português (Brasil)', ready: true },
    { id: 'en', label: 'English', ready: false },
  ] as const
  return (
    <Card>
      <div role="radiogroup" aria-label="Idioma da interface" className="flex flex-col">
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex items-center gap-2.5 border-b border-border px-4 py-3 last:border-b-0 ${
              o.ready ? '' : 'text-fg-muted'
            }`}
          >
            <input
              type="radio"
              name="language"
              checked={language === o.id}
              disabled={!o.ready}
              onChange={() => {}}
              className="accent-accent"
            />
            <span className="flex-1">{o.label}</span>
            {!o.ready && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                em breve
              </span>
            )}
          </label>
        ))}
      </div>
    </Card>
  )
}

function EditorAndTerminal() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  return (
    <Card>
      <Row title="Fonte do editor" hint="Editor de arquivos e diffs.">
        <FontStepper
          label="Fonte do editor"
          value={settings.editorFontSize}
          onChange={(v) => void update({ editorFontSize: v })}
        />
      </Row>
      <Row title="Fonte do terminal" hint="Vale também para os terminais já abertos.">
        <FontStepper
          label="Fonte do terminal"
          value={settings.terminalFontSize}
          onChange={(v) => void update({ terminalFontSize: v })}
        />
      </Row>
      <Row
        title="Restaurar terminais"
        hint="Guarda o histórico dos terminais ao fechar a pasta ou o app e reabre do mesmo jeito."
      >
        <Switch
          label="Restaurar terminais"
          checked={settings.restoreTerminals}
          onChange={(v) => void update({ restoreTerminals: v })}
        />
      </Row>
    </Card>
  )
}

function Agents() {
  const hooks = useSessionsStore((s) => s.hooks)
  const notifications = useSettingsStore((s) => s.settings.notifications)
  const update = useSettingsStore((s) => s.update)
  const connected = CLIS.filter((cli) => hooks[cli]?.installed)
  return (
    <Card>
      <Row
        title="Integrações"
        hint={
          connected.length > 0
            ? `Conectados: ${connected.map((c) => CLI_LABEL[c]).join(', ')}.`
            : 'Nenhum CLI conectado: o Kite só sabe quem espera pelos agentes abertos aqui dentro.'
        }
      >
        <button type="button" className={BTN} onClick={openConnectAgents}>
          Conectar agentes
        </button>
      </Row>
      <Row
        title="Presets dos CLIs"
        hint="Comando de cada agente e como o prompt inicial é passado."
      >
        <button
          type="button"
          className={BTN}
          onClick={() => {
            showAttentionView()
            useAttentionStore.getState().set({ mode: 'presets' })
          }}
        >
          Ajustar
        </button>
      </Row>
      <Row
        title="Notificações"
        hint="Notificação do sistema quando um agente pede permissão, espera você ou termina."
      >
        <Switch
          label="Notificações"
          checked={notifications}
          onChange={(v) => void update({ notifications: v })}
        />
      </Row>
    </Card>
  )
}

function Tasks() {
  const ws = useTasksStore((s) => s.workspace)
  if (!ws) {
    return (
      <Card>
        <p className="px-4 py-3.5 text-fg-muted">
          Abra uma pasta para configurar como as worktrees viram tarefas.
        </p>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {/* Remonta ao trocar de workspace ou de modo, para o campo de padrão começar certo. */}
      <GroupingFieldset key={`${ws.root}:${ws.grouping.mode}`} grouping={ws.grouping} />
      <p className="text-xs leading-[1.45] text-fg-muted">
        Vale para a pasta aberta. O padrão de pasta também define onde &quot;+ Nova&quot; cria as
        worktrees das tarefas novas.
      </p>
    </div>
  )
}

function GitHub() {
  const auth = useGitHubStore((s) => s.auth)
  const user = auth?.user ?? null
  if (!auth)
    return (
      <Card>
        <p className="px-4 py-3.5 text-fg-muted">Carregando…</p>
      </Card>
    )
  if (!auth.configured) {
    return (
      <Card>
        <Row
          title="Login não configurado"
          hint={
            <>
              Crie um OAuth App com Device Flow e coloque o Client ID em{' '}
              <span className="font-geist-mono">GITHUB_CLIENT_ID</span>, num arquivo{' '}
              <span className="font-geist-mono">.env</span>. Depois reinicie o Kite.
            </>
          }
        >
          <button
            type="button"
            className={BTN}
            onClick={() => window.open(`${REPO_URL}#getting-started`, '_blank')}
          >
            Como configurar
          </button>
        </Row>
      </Card>
    )
  }
  return (
    <Card>
      <Row
        title={user ? `Conectado como ${user.login}` : 'Não conectado'}
        hint={
          user
            ? auth.secureStorage
              ? 'O token fica criptografado no cofre do sistema.'
              : 'Sem cofre do sistema: o login vale até fechar o app.'
            : 'Entre para ver PRs e issues, abrir PRs e entregar tarefas.'
        }
      >
        {user ? (
          <span className="flex items-center gap-3">
            <img src={user.avatarUrl} alt="" className="size-6 rounded-full" />
            <button type="button" className={BTN} onClick={() => void logout()}>
              Sair
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={BTN}
            onClick={() => {
              const layout = useLayoutStore.getState()
              if (layout.activeView !== 'github' || !layout.sidebarVisible)
                layout.selectView('github')
              void login()
            }}
          >
            Entrar com GitHub
          </button>
        )}
      </Row>
    </Card>
  )
}

function About() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.app.getInfo().then((res) => res.ok && setInfo(res.data))
  }, [])
  return (
    <Card>
      <Row
        title={info ? `${info.name} ${info.version}` : 'Kite'}
        hint={
          info
            ? `Electron ${info.versions.electron} · Chromium ${info.versions.chrome} · Node ${info.versions.node} · licença MIT`
            : undefined
        }
      >
        <span className="flex gap-2">
          <button type="button" className={BTN} onClick={() => window.open(REPO_URL, '_blank')}>
            Projeto no GitHub
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => window.open(`${REPO_URL}/issues/new`, '_blank')}
          >
            Relatar um problema
          </button>
        </span>
      </Row>
    </Card>
  )
}

export function SettingsPanel() {
  const scroller = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<SectionId>('appearance')

  // Destaca na navegação a seção que está no topo da área visível.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setCurrent(top.target.id.replace('settings-', '') as SectionId)
      },
      { root, rootMargin: '0px 0px -70% 0px' },
    )
    for (const s of SECTIONS) {
      const el = root.querySelector(`#settings-${s.id}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const go = (id: SectionId) => {
    setCurrent(id)
    scroller.current
      ?.querySelector(`#settings-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      ref={scroller}
      className="h-full overflow-y-auto bg-surface-0 font-geist text-[13px] text-fg"
    >
      <div className="flex min-h-full justify-center px-6 py-9">
        <div className="flex w-full max-w-[960px] flex-col gap-6">
          <header>
            <span className={LABEL}>Kite</span>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">Configurações</h1>
            <p className="mt-2 max-w-[720px] leading-normal text-fg-muted">
              Valem para todas as pastas, exceto o agrupamento das tarefas, que é de cada workspace.
              As mudanças são salvas na hora.
            </p>
          </header>
          <div className="flex items-start gap-8">
            <nav
              aria-label="Seções das configurações"
              className="sticky top-0 hidden w-44 shrink-0 flex-col gap-0.5 md:flex"
            >
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-current={current === s.id ? 'true' : undefined}
                  onClick={() => go(s.id)}
                  className={`h-8 rounded-md px-2.5 text-left ${
                    current === s.id
                      ? 'bg-surface-2 font-medium text-fg'
                      : 'text-fg-muted hover:bg-surface-1 hover:text-fg'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
            <div className="flex min-w-0 flex-1 flex-col gap-8 pb-[40vh]">
              <Section id="appearance" title="Aparência">
                <Appearance />
              </Section>
              <Section id="language" title="Idioma">
                <Language />
              </Section>
              <Section id="editor" title="Editor e terminal">
                <EditorAndTerminal />
              </Section>
              <Section id="agents" title="Agentes e notificações">
                <Agents />
              </Section>
              <Section id="tasks" title="Tarefas">
                <Tasks />
              </Section>
              <Section id="github" title="GitHub">
                <GitHub />
              </Section>
              <Section id="about" title="Sobre">
                <About />
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
