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
import { bracketColors, SYNTAX, syntaxRules } from './syntax-themes'

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

// TS/JS: o worker do Monaco vê cada arquivo isolado, sem tsconfig, node_modules nem os outros
// arquivos do projeto. A validação semântica marcaria todo import e todo JSX como erro, então
// fica só a sintática (erros de digitação de verdade). Tipos do projeto ficam para o LSP.
const ts = monaco.typescript
const compilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  allowNonTsExtensions: true,
  esModuleInterop: true,
  isolatedModules: true,
}
for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
  defaults.setCompilerOptions(compilerOptions)
  defaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  })
}

// Um tema do Monaco por tema do app, com as cores lidas do CSS. Trocar de tema é só trocar o
// nome (o Monaco ignora setTheme com o mesmo nome mesmo após redefinir o tema).
export function monacoThemeName(theme: ThemeId): string {
  return `kite-${theme}`
}

// Os temas são definidos na primeira montagem de um editor, não no carregamento do módulo: em
// dev o Vite injeta o styles.css depois dos módulos JS, e ler as variáveis CSS antes disso dava
// cores vazias (texto preto sobre o fundo escuro).
let themesDefined = false
function defineMonacoThemes(): void {
  if (themesDefined) return
  themesDefined = true
  for (const t of THEMES) {
    const p = paletteOf(t.id)
    monaco.editor.defineTheme(monacoThemeName(t.id), {
      base: t.kind === 'light' ? 'vs' : 'vs-dark',
      inherit: true,
      rules: syntaxRules(SYNTAX[t.id]),
      colors: {
        ...bracketColors(SYNTAX[t.id]),
        'editorBracketHighlight.unexpectedBracket.foreground': p.danger,
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
        // Seleção e realces no accent do tema (o padrão é o azul do VS Code em todos).
        'editor.selectionBackground': withAlpha(p.accent, 0.3),
        'editor.inactiveSelectionBackground': withAlpha(p.accent, 0.15),
        'editor.selectionHighlightBackground': withAlpha(p.accent, 0.15),
        'editor.wordHighlightBackground': withAlpha(p['fg-muted'], 0.15),
        'editor.wordHighlightStrongBackground': withAlpha(p['fg-muted'], 0.22),
        'editor.findMatchBackground': withAlpha(p.accent, 0.45),
        'editor.findMatchHighlightBackground': withAlpha(p.accent, 0.2),
        'editorBracketMatch.background': withAlpha(p.accent, 0.15),
        'editorBracketMatch.border': withAlpha(p.accent, 0.5),
        'editorIndentGuide.background1': withAlpha(p['fg-muted'], 0.15),
        'editorIndentGuide.activeBackground1': withAlpha(p['fg-muted'], 0.4),
        'scrollbarSlider.background': withAlpha(p['fg-muted'], 0.2),
        'scrollbarSlider.hoverBackground': withAlpha(p['fg-muted'], 0.3),
        'scrollbarSlider.activeBackground': withAlpha(p['fg-muted'], 0.4),
        'editorOverviewRuler.border': '#00000000',
      },
    })
  }
}

// Os editores passam o nome do tema atual na prop `theme`.
export function useMonacoTheme(): string {
  const theme = useThemeStore((s) => s.theme)
  defineMonacoThemes()
  return monacoThemeName(theme)
}

loader.config({ monaco })

export { monaco }
