import type { ITheme } from '@xterm/xterm'
import { themeInfo, type ThemeId } from '@shared/themes'
import { paletteOf, withAlpha } from '../../lib/theme-colors'

const DARK_ANSI = {
  black: '#1d1d20',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e5e5e5',
  brightBlack: '#6b7280',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#ffffff',
}

const LIGHT_ANSI = {
  black: '#24292f',
  red: '#cf222e',
  green: '#116329',
  yellow: '#7d4e00',
  blue: '#0550ae',
  magenta: '#8250df',
  cyan: '#1b7c83',
  white: '#6e7781',
  brightBlack: '#57606a',
  brightRed: '#a40e26',
  brightGreen: '#1a7f37',
  brightYellow: '#633c01',
  brightBlue: '#218bff',
  brightMagenta: '#a475f9',
  brightCyan: '#3192aa',
  brightWhite: '#8c959f',
}

// Tema do xterm a partir das cores do tema do app.
export function terminalTheme(theme: ThemeId): ITheme {
  const p = paletteOf(theme)
  return {
    background: p['surface-0'],
    foreground: p.fg,
    cursor: p.fg,
    cursorAccent: p['surface-0'],
    selectionBackground: withAlpha(p.accent, 0.33),
    ...(themeInfo(theme).kind === 'light' ? LIGHT_ANSI : DARK_ANSI),
  }
}
