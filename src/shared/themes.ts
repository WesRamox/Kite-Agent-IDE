// Temas da interface. As cores de cada tema ficam em `renderer/src/styles.css`
// (`[data-theme="<id>"]`); aqui só o que o main também precisa (fundo da janela, claro/escuro).

export type ThemeId = 'kite' | 'dark' | 'midnight' | 'dimmed' | 'light' | 'paper'

export interface ThemeInfo {
  id: ThemeId
  label: string
  kind: 'dark' | 'light'
  // Fundo da janela antes do primeiro paint (evita flash) e amostras no seletor.
  background: string
  swatches: [string, string, string]
}

export const THEMES: readonly ThemeInfo[] = [
  {
    id: 'kite',
    label: 'Kite (padrão)',
    kind: 'dark',
    background: '#0b0b0c',
    swatches: ['#0b0b0c', '#2c2a27', '#ffb224'],
  },
  {
    id: 'dark',
    label: 'Escuro',
    kind: 'dark',
    background: '#000000',
    swatches: ['#000000', '#161616', '#3b82f6'],
  },
  {
    id: 'midnight',
    label: 'Meia-noite',
    kind: 'dark',
    background: '#0f1115',
    swatches: ['#0f1115', '#262b38', '#6d8cff'],
  },
  {
    id: 'dimmed',
    label: 'Meio-termo',
    kind: 'dark',
    background: '#22272e',
    swatches: ['#22272e', '#373e47', '#539bf5'],
  },
  {
    id: 'light',
    label: 'Claro',
    kind: 'light',
    background: '#ffffff',
    swatches: ['#ffffff', '#e1e4e8', '#2563eb'],
  },
  {
    id: 'paper',
    label: 'Papel',
    kind: 'light',
    background: '#f8f4ec',
    swatches: ['#f8f4ec', '#e6dccb', '#b0632c'],
  },
]

export const DEFAULT_THEME: ThemeId = 'kite'

export function themeInfo(id: string): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? (THEMES[0] as ThemeInfo)
}

export function isThemeId(id: unknown): id is ThemeId {
  return typeof id === 'string' && THEMES.some((t) => t.id === id)
}
