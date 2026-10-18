import type { MessageKey } from '@shared/i18n'

// Classes e seções da página de configurações.
export const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'
export const BTN =
  'h-[30px] shrink-0 rounded-[7px] border border-border bg-surface-2 px-3 font-medium text-fg hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50'
export const REPO_URL = 'https://github.com/WesRamox/Kite-Agent-IDE'

export const SECTIONS = [
  { id: 'appearance', label: 'settings.appearance' },
  { id: 'language', label: 'settings.language' },
  { id: 'editor', label: 'settings.editor' },
  { id: 'agents', label: 'settings.agents' },
  { id: 'tasks', label: 'settings.tasks' },
  { id: 'github', label: 'settings.github' },
  { id: 'about', label: 'settings.about' },
] as const satisfies readonly { id: string; label: MessageKey }[]

export type SectionId = (typeof SECTIONS)[number]['id']
