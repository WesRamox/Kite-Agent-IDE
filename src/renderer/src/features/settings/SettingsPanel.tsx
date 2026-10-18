import { FONT_MAX, FONT_MIN } from '@shared/settings'
import { THEMES } from '@shared/themes'
import type { MessageKey } from '@shared/i18n'
import { Check, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLayoutStore } from '../../stores/layout.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useThemeStore } from '../../stores/theme.store'
import { showAttentionView } from '../agents/attention.actions'
import { useAttentionStore } from '../agents/attention.store'
import { CLI_LABEL, CLIS } from '../../lib/agent-cli'
import { openConnectAgents } from '../agents/sessions.actions'
import { useSessionsStore } from '../agents/sessions.store'
import { login, logout } from '../github/github.actions'
import { useGitHubStore } from '../github/github.store'
import { GroupingFieldset } from '../tasks/GroupingFieldset'
import { useTasksStore } from '../tasks/tasks.store'
import { closeModal } from '../../stores/modal.store'
import { useT } from '../../lib/i18n'
import { useAppInfo } from '../../lib/use-app-info'

// Página de configurações: aparência, idioma, editor e terminal, agentes, tarefas, GitHub e sobre.
// Mesmo visual das telas de configuração do canvas (Hooks.dc.html): cards em surface-1.

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'
const BTN =
  'h-[30px] shrink-0 rounded-[7px] border border-border bg-surface-2 px-3 font-medium text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50'
const REPO_URL = 'https://github.com/WesRamox/Kite-Agent-IDE'

const SECTIONS = [
  { id: 'appearance', label: 'settings.appearance' },
  { id: 'language', label: 'settings.language' },
  { id: 'editor', label: 'settings.editor' },
  { id: 'agents', label: 'settings.agents' },
  { id: 'tasks', label: 'settings.tasks' },
  { id: 'github', label: 'settings.github' },
  { id: 'about', label: 'settings.about' },
] as const satisfies readonly { id: string; label: MessageKey }[]

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
  const t = useT()
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
        aria-label={t('settings.decrease', { label })}
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
        aria-label={t('settings.increase', { label })}
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
  const tr = useT()
  return (
    <div
      role="radiogroup"
      aria-label={tr('settings.theme')}
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
              <span className="flex-1 truncate">{tr(`theme.${t.id}`)}</span>
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
  const update = useSettingsStore((s) => s.update)
  const t = useT()
  // Cada idioma aparece no próprio idioma, como de costume.
  const options = [
    { id: 'pt-BR', label: 'Português (Brasil)' },
    { id: 'en', label: 'English' },
  ] as const
  return (
    <Card>
      <div role="radiogroup" aria-label={t('settings.languageGroup')} className="flex flex-col">
        {options.map((o) => (
          <label
            key={o.id}
            className="flex items-center gap-2.5 border-b border-border px-4 py-3 last:border-b-0"
          >
            <input
              type="radio"
              name="language"
              checked={language === o.id}
              onChange={() => void update({ language: o.id })}
              className="accent-accent"
            />
            <span className="flex-1" lang={o.id}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </Card>
  )
}

function EditorAndTerminal() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const t = useT()
  return (
    <Card>
      <Row title={t('settings.editorFont')} hint={t('settings.editorFontHint')}>
        <FontStepper
          label={t('settings.editorFont')}
          value={settings.editorFontSize}
          onChange={(v) => void update({ editorFontSize: v })}
        />
      </Row>
      <Row title={t('settings.terminalFont')} hint={t('settings.terminalFontHint')}>
        <FontStepper
          label={t('settings.terminalFont')}
          value={settings.terminalFontSize}
          onChange={(v) => void update({ terminalFontSize: v })}
        />
      </Row>
      <Row title={t('settings.restoreTerminals')} hint={t('settings.restoreTerminalsHint')}>
        <Switch
          label={t('settings.restoreTerminals')}
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
  const t = useT()
  return (
    <Card>
      <Row
        title={t('settings.integrations')}
        hint={
          connected.length > 0
            ? t('settings.connected', { list: connected.map((c) => CLI_LABEL[c]).join(', ') })
            : t('settings.noneConnected')
        }
      >
        <button type="button" className={BTN} onClick={openConnectAgents}>
          {t('settings.connectAgents')}
        </button>
      </Row>
      <Row title={t('settings.presets')} hint={t('settings.presetsHint')}>
        <button
          type="button"
          className={BTN}
          onClick={() => {
            closeModal()
            showAttentionView()
            useAttentionStore.getState().set({ mode: 'presets' })
          }}
        >
          {t('settings.adjust')}
        </button>
      </Row>
      <Row title={t('settings.notifications')} hint={t('settings.notificationsHint')}>
        <Switch
          label={t('settings.notifications')}
          checked={notifications}
          onChange={(v) => void update({ notifications: v })}
        />
      </Row>
    </Card>
  )
}

function Tasks() {
  const ws = useTasksStore((s) => s.workspace)
  const t = useT()
  if (!ws) {
    return (
      <Card>
        <p className="px-4 py-3.5 text-fg-muted">{t('settings.openFolderForTasks')}</p>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {/* Remonta ao trocar de workspace ou de modo, para o campo de padrão começar certo. */}
      <GroupingFieldset key={`${ws.root}:${ws.grouping.mode}`} grouping={ws.grouping} />
      <p className="text-xs leading-[1.45] text-fg-muted">{t('settings.tasksHint')}</p>
    </div>
  )
}

function GitHub() {
  const auth = useGitHubStore((s) => s.auth)
  const user = auth?.user ?? null
  const t = useT()
  if (!auth)
    return (
      <Card>
        <p className="px-4 py-3.5 text-fg-muted">{t('common.loading')}</p>
      </Card>
    )
  if (!auth.configured) {
    return (
      <Card>
        <Row title={t('settings.loginNotConfigured')} hint={t('settings.loginNotConfiguredHint')}>
          <button
            type="button"
            className={BTN}
            onClick={() => window.open(`${REPO_URL}#getting-started`, '_blank')}
          >
            {t('settings.howToConfigure')}
          </button>
        </Row>
      </Card>
    )
  }
  return (
    <Card>
      <Row
        title={user ? t('settings.connectedAs', { login: user.login }) : t('settings.notConnected')}
        hint={
          user
            ? auth.secureStorage
              ? t('settings.tokenSecure')
              : t('settings.tokenMemory')
            : t('settings.signInHint')
        }
      >
        {user ? (
          <span className="flex items-center gap-3">
            <img src={user.avatarUrl} alt="" className="size-6 rounded-full" />
            <button type="button" className={BTN} onClick={() => void logout()}>
              {t('settings.signOut')}
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={BTN}
            onClick={() => {
              closeModal()
              const layout = useLayoutStore.getState()
              if (layout.activeView !== 'github' || !layout.sidebarVisible)
                layout.selectView('github')
              void login()
            }}
          >
            {t('settings.signIn')}
          </button>
        )}
      </Row>
    </Card>
  )
}

function About() {
  const info = useAppInfo()
  const t = useT()
  return (
    <Card>
      <Row
        title={info ? `${info.name} ${info.version}` : 'Kite'}
        hint={
          info
            ? t('settings.versions', {
                electron: info.versions.electron,
                chrome: info.versions.chrome,
                node: info.versions.node,
              })
            : undefined
        }
      >
        <span className="flex gap-2">
          <button type="button" className={BTN} onClick={() => window.open(REPO_URL, '_blank')}>
            {t('settings.projectOnGitHub')}
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => window.open(`${REPO_URL}/issues/new`, '_blank')}
          >
            {t('settings.reportIssue')}
          </button>
        </span>
      </Row>
    </Card>
  )
}

export function SettingsPanel() {
  const scroller = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<SectionId>('appearance')
  const t = useT()

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
            <span className={LABEL}>{t('settings.kicker')}</span>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
              {t('settings.title')}
            </h1>
            <p className="mt-2 max-w-[720px] leading-normal text-fg-muted">{t('settings.intro')}</p>
          </header>
          <div className="flex items-start gap-8">
            <nav
              aria-label={t('settings.sections')}
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
                  {t(s.label)}
                </button>
              ))}
            </nav>
            <div className="flex min-w-0 flex-1 flex-col gap-8 pb-[40vh]">
              <Section id="appearance" title={t('settings.appearance')}>
                <Appearance />
              </Section>
              <Section id="language" title={t('settings.language')}>
                <Language />
              </Section>
              <Section id="editor" title={t('settings.editor')}>
                <EditorAndTerminal />
              </Section>
              <Section id="agents" title={t('settings.agents')}>
                <Agents />
              </Section>
              <Section id="tasks" title={t('settings.tasks')}>
                <Tasks />
              </Section>
              <Section id="github" title={t('settings.github')}>
                <GitHub />
              </Section>
              <Section id="about" title={t('settings.about')}>
                <About />
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
