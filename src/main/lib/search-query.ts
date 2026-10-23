import type { SearchFile, SearchMatch, SearchQuery } from '@shared/types'

// Limites da busca: o resultado vai inteiro para o renderer, então é cortado antes.
export const MAX_MATCHES = 2000
export const MAX_GLOBS = 30
const PREVIEW_MAX = 240
const PREVIEW_BEFORE = 40
const MAX_RANGES = 50

// Argumentos do `git grep` na worktree. O texto vai sempre depois de `-e` (nunca é lido como
// opção) e os filtros, depois de `--`, como pathspecs com a mágica `glob`, que o git mantém
// dentro da worktree. `--untracked` inclui arquivos novos e continua respeitando o .gitignore;
// `-I` pula binários.
export function grepArgs(q: SearchQuery): string[] {
  return [
    'grep',
    '-n',
    '--column',
    '-I',
    '--null',
    '--no-color',
    '--untracked',
    ...(q.caseSensitive ? [] : ['-i']),
    ...(q.wholeWord ? ['-w'] : []),
    q.regex ? '-E' : '-F',
    '-e',
    q.text,
    '--',
    ...pathspecs(q.include, q.exclude),
  ]
}

export function globList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim().replace(/\\/g, '/'))
    .filter((s) => s !== '')
    .slice(0, MAX_GLOBS)
}

// Como no VS Code: padrão sem `/` vale em qualquer pasta ("*.ts", "node_modules"), e um nome de
// pasta inclui o que está dentro dela.
function toGlobs(pattern: string): string[] {
  const clean = pattern.replace(/^(\.\/|\/)+/, '').replace(/\/+$/, '')
  if (!clean) return []
  const base = clean.includes('/') ? clean : `**/${clean}`
  return [base, `${base}/**`]
}

export function pathspecs(include: string, exclude: string): string[] {
  return [
    ...globList(include)
      .flatMap(toGlobs)
      .map((g) => `:(glob)${g}`),
    ...globList(exclude)
      .flatMap(toGlobs)
      .map((g) => `:(exclude,glob)${g}`),
  ]
}

// Regex do JavaScript equivalente à busca, só para marcar as ocorrências no trecho. Regex do
// usuário que o JavaScript não entende (o git usa ERE): null, e a linha aparece sem marcação.
export function matcher(q: SearchQuery): RegExp | null {
  const source = q.regex ? q.text : q.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Palavra inteira como no `git grep -w`: sem letra, dígito ou `_` dos dois lados.
  const body = q.wholeWord ? `(?<![A-Za-z0-9_])(?:${source})(?![A-Za-z0-9_])` : source
  try {
    return new RegExp(body, q.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

export function matchRanges(text: string, re: RegExp | null): [number, number][] {
  if (!re) return []
  const ranges: [number, number][] = []
  re.lastIndex = 0
  for (let m = re.exec(text); m && ranges.length < MAX_RANGES; m = re.exec(text)) {
    // Ocorrência vazia (ex.: `a*`) não marca nada e não pode travar o laço.
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    ranges.push([m.index, m.index + m[0].length])
  }
  return ranges
}

// Trecho mostrado: sem o recuo e, em linha longa, a partir de um pouco antes da 1ª ocorrência.
export function preview(
  text: string,
  ranges: [number, number][],
): { preview: string; ranges: [number, number][] } {
  const indent = text.length - text.trimStart().length
  const first = ranges[0]?.[0] ?? indent
  let start = indent
  let prefix = ''
  if (text.length - indent > PREVIEW_MAX && first - indent > PREVIEW_BEFORE) {
    start = first - PREVIEW_BEFORE
    prefix = '…'
  }
  const end = Math.min(text.length, start + PREVIEW_MAX)
  const suffix = end < text.length ? '…' : ''
  const shift = prefix.length - start
  return {
    preview: `${prefix}${text.slice(start, end)}${suffix}`,
    ranges: ranges
      .filter(([s]) => s >= start && s < end)
      .map(([s, e]) => [s + shift, Math.min(e, end) + shift]),
  }
}

// Saída de `git grep -n --column --null`: `caminho\0linha\0coluna\0texto` por linha. Para no
// limite `budget` de ocorrências (linhas).
export function parseGrep(
  out: string,
  worktree: string,
  re: RegExp | null,
  budget: number,
  join: (a: string, b: string) => string,
): { files: SearchFile[]; matches: number; truncated: boolean } {
  const files = new Map<string, SearchFile>()
  let matches = 0
  for (const record of out.split('\n')) {
    if (!record) continue
    const [rel = '', line = '', col = '', ...rest] = record.split('\0')
    const lineNo = Number(line)
    if (!rel || !Number.isInteger(lineNo)) continue
    if (matches >= budget) return { files: [...files.values()], matches, truncated: true }
    const text = rest.join('\0').replace(/\r$/, '')
    const ranges = matchRanges(text, re)
    const first = ranges[0]
    const match: SearchMatch = {
      line: lineNo,
      // A coluna do git conta bytes; a do JavaScript, caracteres (é a que o editor usa).
      column: first ? first[0] + 1 : Math.max(1, Number(col) || 1),
      length: first ? first[1] - first[0] : 0,
      ...preview(text, ranges),
    }
    let file = files.get(rel)
    if (!file) {
      file = { path: join(worktree, rel), rel, matches: [] }
      files.set(rel, file)
    }
    file.matches.push(match)
    matches++
  }
  return { files: [...files.values()], matches, truncated: false }
}
