// Utilitários de caminho no renderer (sem `node:path`). Os caminhos vêm do main no formato
// nativo do SO: separador '\' no Windows, '/' nos demais.

export function sepOf(p: string): '/' | '\\' {
  return /^[a-zA-Z]:\\/.test(p) || p.startsWith('\\\\') ? '\\' : '/'
}

function trimTrailing(p: string): string {
  const sep = sepOf(p)
  return p.length > 1 && p.endsWith(sep) && !/^[a-zA-Z]:\\$/.test(p) ? p.slice(0, -1) : p
}

export function basename(p: string): string {
  const clean = trimTrailing(p)
  return clean.slice(clean.lastIndexOf(sepOf(clean)) + 1)
}

export function dirname(p: string): string {
  const clean = trimTrailing(p)
  const sep = sepOf(clean)
  const idx = clean.lastIndexOf(sep)
  if (idx <= 0) return sep
  const parent = clean.slice(0, idx)
  return /^[a-zA-Z]:$/.test(parent) ? parent + sep : parent
}

export function join(dir: string, name: string): string {
  const sep = sepOf(dir)
  return dir.endsWith(sep) ? dir + name : dir + sep + name
}

export function isInside(root: string, p: string): boolean {
  const sep = sepOf(root)
  return p === root || p.startsWith(root.endsWith(sep) ? root : root + sep)
}

// Caminho relativo com '/' (para exibição e busca).
export function relative(root: string, p: string): string {
  if (!isInside(root, p) || p === root) return p
  const sep = sepOf(root)
  const rest = p.slice(root.endsWith(sep) ? root.length : root.length + 1)
  return sep === '\\' ? rest.replaceAll('\\', '/') : rest
}

// Troca o prefixo `from` por `to` (usado ao renomear pastas com arquivos abertos).
export function rebase(p: string, from: string, to: string): string {
  return p === from ? to : to + p.slice(from.length)
}

// Nome válido para criar/renomear: sem separadores, sem '.' e '..'.
export function isValidName(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..' && !/[\\/\0]/.test(name)
}
