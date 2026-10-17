// Cores de sintaxe por tema do app, adaptadas de temas populares do VS Code. O fundo, o texto
// comum e a UI do editor continuam vindo do CSS do tema (monaco-setup); aqui ficam só as cores
// dos tokens, que não existem no resto da interface.
import type { ThemeId } from '@shared/themes'

export interface SyntaxPalette {
  // Tema do VS Code em que a paleta se baseia.
  source: string
  comment: string
  keyword: string
  string: string
  // Escapes em strings e expressões regulares.
  escape: string
  number: string
  type: string
  // Tags HTML/JSX.
  tag: string
  attribute: string
  delimiter: string
  operator: string
  // Chaves de JSON/YAML e propriedades CSS.
  key: string
  variable: string
  // Decorators, diretivas e meta-tags.
  meta: string
  brackets: [string, string, string]
  italicComments: boolean
}

export const SYNTAX: Record<ThemeId, SyntaxPalette> = {
  kite: {
    source: 'Ayu Dark',
    comment: '#6b7079',
    keyword: '#ff8f40',
    string: '#aad94c',
    escape: '#95e6cb',
    number: '#d2a6ff',
    type: '#59c2ff',
    tag: '#39bae6',
    attribute: '#ffb454',
    delimiter: '#bfbdb6',
    operator: '#f29668',
    key: '#59c2ff',
    variable: '#39bae6',
    meta: '#e6b673',
    brackets: ['#ffb224', '#d2a6ff', '#59c2ff'],
    italicComments: true,
  },
  dark: {
    source: 'One Dark Pro',
    comment: '#7f848e',
    keyword: '#c678dd',
    string: '#98c379',
    escape: '#56b6c2',
    number: '#d19a66',
    type: '#e5c07b',
    tag: '#e06c75',
    attribute: '#d19a66',
    delimiter: '#abb2bf',
    operator: '#56b6c2',
    key: '#e06c75',
    variable: '#e06c75',
    meta: '#61afef',
    brackets: ['#d19a66', '#c678dd', '#56b6c2'],
    italicComments: true,
  },
  midnight: {
    source: 'Tokyo Night',
    comment: '#5f6996',
    keyword: '#bb9af7',
    string: '#9ece6a',
    escape: '#89ddff',
    number: '#ff9e64',
    type: '#2ac3de',
    tag: '#f7768e',
    attribute: '#bb9af7',
    delimiter: '#89ddff',
    operator: '#89ddff',
    key: '#7aa2f7',
    variable: '#7aa2f7',
    meta: '#e0af68',
    brackets: ['#698cd6', '#68b3de', '#9a7ecc'],
    italicComments: true,
  },
  dimmed: {
    source: 'GitHub Dark Dimmed',
    comment: '#768390',
    keyword: '#f47067',
    string: '#96d0ff',
    escape: '#8ddb8c',
    number: '#6cb6ff',
    type: '#f69d50',
    tag: '#8ddb8c',
    attribute: '#6cb6ff',
    delimiter: '#adbac7',
    operator: '#f47067',
    key: '#6cb6ff',
    variable: '#f69d50',
    meta: '#dcbdfb',
    brackets: ['#6cb6ff', '#8ddb8c', '#dcbdfb'],
    italicComments: false,
  },
  light: {
    source: 'GitHub Light',
    comment: '#6e7781',
    keyword: '#cf222e',
    string: '#0a3069',
    escape: '#116329',
    number: '#0550ae',
    type: '#953800',
    tag: '#116329',
    attribute: '#0550ae',
    delimiter: '#1f2328',
    operator: '#cf222e',
    key: '#0550ae',
    variable: '#953800',
    meta: '#8250df',
    brackets: ['#0969da', '#1a7f37', '#9a6700'],
    italicComments: false,
  },
  paper: {
    source: 'Gruvbox Light',
    // O cinza do Gruvbox (#928374) fica abaixo de 3:1 no fundo do Papel; escurecido.
    comment: '#7c6f64',
    keyword: '#9d0006',
    string: '#79740e',
    escape: '#427b58',
    number: '#8f3f71',
    type: '#b57614',
    tag: '#076678',
    attribute: '#427b58',
    delimiter: '#3c3836',
    operator: '#af3a03',
    key: '#076678',
    variable: '#076678',
    meta: '#8f3f71',
    brackets: ['#af3a03', '#076678', '#8f3f71'],
    italicComments: true,
  },
}

export interface TokenRule {
  token: string
  foreground?: string
  fontStyle?: string
}

// Regras do Monaco (Monarch). Um token casa com a regra de nome mais longo que for prefixo dele:
// `number` cobre `number.hex`, `string.key.json` vence `string`.
export function syntaxRules(s: SyntaxPalette): TokenRule[] {
  const fg = (hex: string) => hex.slice(1)
  return [
    { token: 'comment', foreground: fg(s.comment), fontStyle: s.italicComments ? 'italic' : '' },
    { token: 'keyword', foreground: fg(s.keyword) },
    { token: 'storage', foreground: fg(s.keyword) },
    { token: 'string', foreground: fg(s.string) },
    { token: 'string.escape', foreground: fg(s.escape) },
    { token: 'regexp', foreground: fg(s.escape) },
    { token: 'number', foreground: fg(s.number) },
    { token: 'constant', foreground: fg(s.number) },
    { token: 'type', foreground: fg(s.type) },
    { token: 'predefined', foreground: fg(s.type) },
    { token: 'tag', foreground: fg(s.tag) },
    { token: 'metatag', foreground: fg(s.meta) },
    { token: 'annotation', foreground: fg(s.meta) },
    { token: 'attribute.name', foreground: fg(s.attribute) },
    { token: 'attribute.value', foreground: fg(s.string) },
    { token: 'attribute.value.number', foreground: fg(s.number) },
    { token: 'attribute.value.unit', foreground: fg(s.number) },
    { token: 'delimiter', foreground: fg(s.delimiter) },
    { token: 'operator', foreground: fg(s.operator) },
    { token: 'key', foreground: fg(s.key) },
    { token: 'string.key.json', foreground: fg(s.key) },
    { token: 'string.value.json', foreground: fg(s.string) },
    { token: 'variable', foreground: fg(s.variable) },
    // Markdown.
    { token: 'strong', fontStyle: 'bold' },
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'string.link', foreground: fg(s.tag) },
  ]
}

// Cores dos pares de colchetes (o Monaco usa até 6 níveis; os 3 se repetem).
export function bracketColors(s: SyntaxPalette): Record<string, string> {
  const colors: Record<string, string> = {}
  for (let i = 0; i < 6; i++) {
    colors[`editorBracketHighlight.foreground${i + 1}`] = s.brackets[i % 3] as string
  }
  return colors
}
