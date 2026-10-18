import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { AboutSettings } from './AboutSettings'
import { AgentsSettings } from './AgentsSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { EditorAndTerminalSettings } from './EditorAndTerminalSettings'
import { GitHubSettings } from './GitHubSettings'
import { LanguageSettings } from './LanguageSettings'
import { LABEL, SECTIONS, type SectionId } from './settings-sections'
import { Section } from './settings-ui'
import { TasksSettings } from './TasksSettings'

// Página de configurações: aparência, idioma, editor e terminal, agentes, tarefas, GitHub e sobre.
// Mesmo visual das telas de configuração do canvas (Hooks.dc.html): cards em surface-1.

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
                <AppearanceSettings />
              </Section>
              <Section id="language" title={t('settings.language')}>
                <LanguageSettings />
              </Section>
              <Section id="editor" title={t('settings.editor')}>
                <EditorAndTerminalSettings />
              </Section>
              <Section id="agents" title={t('settings.agents')}>
                <AgentsSettings />
              </Section>
              <Section id="tasks" title={t('settings.tasks')}>
                <TasksSettings />
              </Section>
              <Section id="github" title={t('settings.github')}>
                <GitHubSettings />
              </Section>
              <Section id="about" title={t('settings.about')}>
                <AboutSettings />
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
