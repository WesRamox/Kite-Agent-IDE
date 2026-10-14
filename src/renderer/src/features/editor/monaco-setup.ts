// Monaco empacotado localmente (sem CDN, compatível com a CSP) e workers via Vite.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import { THEMES, type ThemeId } from '@shared/themes'
import { paletteOf, withAlpha } from '../../lib/theme-colors'
import { useThemeStore } from '../../stores/theme.store'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  },
}

// Um tema do Monaco por tema do app, com as cores lidas do CSS. Trocar de tema é só trocar o
// nome (o Monaco ignora setTheme com o mesmo nome mesmo após redefinir o tema).
export function monacoThemeName(theme: ThemeId): string {
  return `kite-${theme}`
}

for (const t of THEMES) {
  const p = paletteOf(t.id)
  monaco.editor.defineTheme(monacoThemeName(t.id), {
    base: t.kind === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': p['surface-0'],
      'editor.foreground': p.fg,
      'editorGutter.background': p['surface-0'],
      'minimap.background': p['surface-0'],
      'editorLineNumber.foreground': withAlpha(p['fg-muted'], 0.6),
      'editorLineNumber.activeForeground': p.fg,
      'editor.lineHighlightBackground': withAlpha(p['surface-2'], 0.6),
      'editor.lineHighlightBorder': '#00000000',
      'editorWidget.background': p['surface-2'],
      'editorWidget.border': p.border,
      'editorCursor.foreground': p.accent,
      focusBorder: p.accent,
    },
  })
}

// Os editores passam o nome do tema atual na prop `theme`.
export function useMonacoTheme(): string {
  return monacoThemeName(useThemeStore((s) => s.theme))
}

loader.config({ monaco })

export { monaco }
