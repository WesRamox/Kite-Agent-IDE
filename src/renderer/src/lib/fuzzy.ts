// Busca fuzzy simples para o quick open: os caracteres da consulta precisam aparecer em
// ordem no alvo. A pontuação favorece sequências contíguas, início de palavra e o nome do
// arquivo (parte depois da última '/').

export interface FuzzyMatch {
  score: number
  positions: number[]
}

const BOUNDARY = /[/\\_\-. ]/

function isBoundary(text: string, i: number): boolean {
  if (i === 0) return true
  const prev = text[i - 1] ?? ''
  const cur = text[i] ?? ''
  return BOUNDARY.test(prev) || (prev === prev.toLowerCase() && cur !== cur.toLowerCase())
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const q = query.replace(/\s+/g, '').toLowerCase()
  if (q.length === 0) return { score: 0, positions: [] }
  const t = target.toLowerCase()
  const nameStart = target.lastIndexOf('/') + 1

  // Prefere casar dentro do nome do arquivo: tenta primeiro a partir do nome.
  const tryFrom = (start: number): FuzzyMatch | null => {
    const positions: number[] = []
    let score = 0
    let ti = start
    let prev = -2
    for (const ch of q) {
      const found = t.indexOf(ch, ti)
      if (found === -1) return null
      positions.push(found)
      score += 1
      if (found === prev + 1) score += 5
      if (isBoundary(target, found)) score += 3
      if (found >= nameStart) score += 2
      prev = found
      ti = found + 1
    }
    // Penaliza alvos longos e lacunas grandes.
    score -= ((positions.at(-1) ?? 0) - (positions[0] ?? 0)) * 0.1
    score -= target.length * 0.01
    return { score, positions }
  }

  const inName = nameStart > 0 ? tryFrom(nameStart) : null
  const anywhere = tryFrom(0)
  if (inName && anywhere) return inName.score >= anywhere.score ? inName : anywhere
  return inName ?? anywhere
}

export interface Ranked<T> {
  item: T
  match: FuzzyMatch
}

export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  key: (item: T) => string,
  limit = 50,
): Ranked<T>[] {
  const out: Ranked<T>[] = []
  for (const item of items) {
    const match = fuzzyMatch(query, key(item))
    if (match) out.push({ item, match })
  }
  out.sort((a, b) => b.match.score - a.match.score || key(a.item).length - key(b.item).length)
  return out.slice(0, limit)
}
