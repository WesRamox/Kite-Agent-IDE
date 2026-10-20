import nodePath from 'node:path'

type PathApi = Pick<typeof nodePath, 'resolve'>

// Opções do `git worktree add` que consomem o argumento seguinte.
const WITH_VALUE = new Set(['-b', '-B', '--reason', '--orphan'])
const MAX_TARGETS = 10

// Palavras de um comando de shell, respeitando aspas. `null` separa comandos (&&, ||, ;, |,
// quebra de linha). Não é um parser de shell: o bastante para achar `cd` e `git worktree add`.
function words(command: string): (string | null)[] {
  const out: (string | null)[] = []
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(&&|\|\||[;|\n])|([^\s"';|&]+|&)/g
  let current = ''
  let has = false
  let last = 0
  const flush = () => {
    if (has) out.push(current)
    current = ''
    has = false
  }
  for (const m of command.matchAll(re)) {
    // Pedaços colados (ex.: --path="a b") formam uma palavra só.
    if (m.index > last && /\s/.test(command.slice(last, m.index))) flush()
    last = m.index + m[0].length
    if (m[3] !== undefined) {
      flush()
      out.push(null)
      continue
    }
    current += m[1] ?? m[2] ?? m[4] ?? ''
    has = true
  }
  flush()
  return out
}

// /c/Users/... (Git Bash no Windows) → C:/Users/...
function fromGitBash(p: string, api: PathApi): string {
  const m = /^\/([a-zA-Z])(\/.*)?$/.exec(p)
  return m && api === nodePath.win32 ? `${m[1]?.toUpperCase()}:${m[2] ?? '/'}` : p
}

// Pastas criadas por `git worktree add` num comando de shell rodado pelo agente em `cwd`.
// Acompanha `cd` e `git -C` para resolver caminhos relativos.
export function worktreeAddTargets(
  command: string,
  cwd: string,
  api: PathApi = nodePath,
): string[] {
  if (!command.includes('worktree')) return []
  const resolve = (base: string, p: string) => api.resolve(base, fromGitBash(p, api))
  const targets: string[] = []
  let base = cwd
  let cmd: string[] = []
  const run = () => {
    const [head, ...rest] = cmd
    cmd = []
    if (head === 'cd' && rest[0]) {
      base = resolve(base, rest[0])
      return
    }
    if (head !== 'git') return
    let dir = base
    let i = 0
    while (i < rest.length && rest[i]?.startsWith('-')) {
      if (rest[i] === '-C' && rest[i + 1]) dir = resolve(dir, rest[++i] ?? '')
      else if (rest[i] === '-c') i++
      i++
    }
    if (rest[i] !== 'worktree' || rest[i + 1] !== 'add') return
    for (let j = i + 2; j < rest.length; j++) {
      const w = rest[j] ?? ''
      if (WITH_VALUE.has(w)) j++
      else if (w === '--') continue
      else if (!w.startsWith('-')) {
        targets.push(resolve(dir, w))
        return
      }
    }
  }
  for (const w of words(command)) {
    if (w === null) run()
    else cmd.push(w)
  }
  run()
  return targets.slice(0, MAX_TARGETS)
}
