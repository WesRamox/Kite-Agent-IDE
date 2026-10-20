// Trecho que mudou entre duas versões de um texto, em linhas (a partir de 1) na versão nova.
// Só o miolo: o que sobra igual no começo e no fim fica de fora.
export function changedLines(before: string, after: string): { start: number; end: number } | null {
  if (before === after) return null
  const a = before.split('\n')
  const b = after.split('\n')
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++
  const start = Math.min(head + 1, b.length)
  const end = Math.min(Math.max(start, b.length - tail), b.length)
  return { start, end }
}
