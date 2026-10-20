import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_IGNORED_NAMES } from './ignore-rules'

const SKIP = new Set(DEFAULT_IGNORED_NAMES)
// Pasta oculta onde o Kite (e skills que seguem o mesmo padrão) põem as worktrees das tarefas.
const WORKTREES_DIR = '.worktrees'
const MAX_DIRS = 2000

export interface ScanResult {
  // Repositórios principais: `.git` é uma pasta.
  repos: string[]
  // Worktrees e submódulos: `.git` é um arquivo. O repositório principal de cada um só o git
  // sabe dizer (o clone pode estar fora da pasta aberta).
  linked: string[]
}

async function gitKind(dir: string): Promise<'repo' | 'linked' | null> {
  return stat(path.join(dir, '.git')).then(
    (s) => (s.isDirectory() ? 'repo' : 'linked'),
    () => null,
  )
}

// Repositórios na pasta aberta: ela mesma e subpastas até `depth` níveis, inclusive dentro de
// outro repositório (repos aninhados ou submódulos) e em `.worktrees`. Pula pastas ignoradas
// (node_modules, dist...) e as demais pastas ocultas.
export async function scanRepos(root: string, depth = 2): Promise<ScanResult> {
  const repos: string[] = []
  const linked: string[] = []
  let visited = 0
  const walk = async (dir: string, level: number): Promise<void> => {
    if (++visited > MAX_DIRS) return
    const kind = await gitKind(dir)
    if (kind) (kind === 'repo' ? repos : linked).push(await realpath(dir))
    // Uma worktree não tem outros repositórios dentro que interessem.
    if (kind === 'linked' || level >= depth) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name)) continue
      if (e.name === WORKTREES_DIR) await walkWorktrees(path.join(dir, e.name))
      else if (!e.name.startsWith('.')) await walk(path.join(dir, e.name), level + 1)
    }
  }
  // .worktrees/<tarefa>/<repo> ou .worktrees/<repo>: dois níveis, contados à parte para que a
  // pasta oculta não esgote a profundidade de quem abriu um nível acima.
  const walkWorktrees = async (dir: string): Promise<void> => {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const sub = path.join(dir, e.name)
      if (++visited > MAX_DIRS) return
      if ((await gitKind(sub)) === 'linked') {
        linked.push(await realpath(sub))
        continue
      }
      for (const w of await readdir(sub, { withFileTypes: true }).catch(() => [])) {
        if (!w.isDirectory() || w.name.startsWith('.')) continue
        const wt = path.join(sub, w.name)
        if (++visited > MAX_DIRS) return
        if ((await gitKind(wt)) === 'linked') linked.push(await realpath(wt))
      }
    }
  }
  await walk(root, 0)
  return { repos: [...new Set(repos)].sort(), linked: [...new Set(linked)].sort() }
}
