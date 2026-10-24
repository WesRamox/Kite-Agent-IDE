// Lógica pura da view de busca.

export interface Segment {
  text: string
  hit: boolean
}

// Divide o trecho da linha em partes marcadas (ocorrências) e não marcadas.
export function segments(preview: string, ranges: [number, number][]): Segment[] {
  const out: Segment[] = []
  let at = 0
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const s = Math.max(start, at)
    const e = Math.min(end, preview.length)
    if (e <= s) continue
    if (s > at) out.push({ text: preview.slice(at, s), hit: false })
    out.push({ text: preview.slice(s, e), hit: true })
    at = e
  }
  if (at < preview.length) out.push({ text: preview.slice(at), hit: false })
  return out
}

// "src/features/x.ts" → nome e pasta, como na lista do VS Code.
export function splitRel(rel: string): { name: string; dir: string } {
  const i = rel.lastIndexOf('/')
  return i < 0 ? { name: rel, dir: '' } : { name: rel.slice(i + 1), dir: rel.slice(0, i) }
}
