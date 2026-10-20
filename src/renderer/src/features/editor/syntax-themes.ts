// Cores de sintaxe por tema do app, adaptadas de temas populares do VS Code. O fundo, o texto
// comum e a UI do editor continuam vindo do CSS do tema (monaco-setup); aqui ficam só as cores
// dos tokens, que não existem no resto da interface.
import type { ThemeId } from '@shared/themes'

// Papéis da paleta: cada regra do Monaco pinta um token com a cor de um papel.
export type SyntaxRole = Exclude<keyof SyntaxPalette, 'source' | 'brackets' | 'italic'>

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
  // Identificadores comuns (variáveis, funções). Sem cor própria, ficam na cor do texto.
  identifier?: string
  brackets: [string, string, string]
  // Papéis escritos em itálico.
  italic: SyntaxRole[]
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
    italic: ['comment'],
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
    italic: ['comment'],
  },
  vivid: {
    source: 'Bearded Theme Vivid Black',
    comment: '#757582',
    keyword: '#ffb638',
    string: '#42dd76',
    escape: '#14e5d4',
    number: '#a95eff',
    // O Monaco marca como tipo todo nome em PascalCase (classes, tipos, componentes).
    type: '#ff478d',
    tag: '#28a9ff',
    attribute: '#14e5d4',
    delimiter: '#7d7d8a',
    operator: '#ffb638',
    key: '#ffb638',
    variable: '#ff7135',
    meta: '#e66dff',
    identifier: '#28a9ff',
    brackets: ['#ffb638', '#e66dff', '#28a9ff'],
    // Mais itálico que o original, como pedido: palavras-chave, tipos, atributos e decorators.
    italic: ['comment', 'keyword', 'type', 'attribute', 'meta'],
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
    italic: ['comment'],
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
    italic: [],
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
    italic: [],
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
    italic: ['comment'],
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
  const italic = new Set(s.italic)
  const rule = (token: string, role: SyntaxRole): TokenRule[] => {
    const color = s[role]
    if (!color) return []
    return [{ token, foreground: color.slice(1), fontStyle: italic.has(role) ? 'italic' : '' }]
  }
  return [
    ...rule('comment', 'comment'),
    ...rule('keyword', 'keyword'),
    ...rule('storage', 'keyword'),
    ...rule('string', 'string'),
    ...rule('string.escape', 'escape'),
    ...rule('regexp', 'escape'),
    ...rule('number', 'number'),
    ...rule('constant', 'number'),
    ...rule('type', 'type'),
    ...rule('predefined', 'type'),
    ...rule('tag', 'tag'),
    ...rule('metatag', 'meta'),
    ...rule('annotation', 'meta'),
    ...rule('attribute.name', 'attribute'),
    ...rule('attribute.value', 'string'),
    ...rule('attribute.value.number', 'number'),
    ...rule('attribute.value.unit', 'number'),
    ...rule('delimiter', 'delimiter'),
    ...rule('operator', 'operator'),
    ...rule('key', 'key'),
    ...rule('string.key.json', 'key'),
    ...rule('string.value.json', 'string'),
    ...rule('variable', 'variable'),
    ...rule('identifier', 'identifier'),
    // Markdown.
    { token: 'strong', fontStyle: 'bold' },
    { token: 'emphasis', fontStyle: 'italic' },
    ...rule('string.link', 'tag'),
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
