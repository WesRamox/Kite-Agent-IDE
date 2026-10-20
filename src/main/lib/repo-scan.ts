import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_IGNORED_NAMES } from './ignore-rules'

const SKIP = new Set(DEFAULT_IGNORED_NAMES)
const MAX_DIRS = 5000

export interface ScanOptions {
  // Níveis abaixo da pasta aberta.
  depth: number
  // Pastas de worktrees de tarefas (a pasta fixa do padrão configurado) e quantos níveis descer
  // nelas. Varridas mesmo ocultas ou fora do alcance de `depth`.
  worktreeDirs: { dir: string; levels: number }[]
}

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
// outro repositório (repos aninhados ou submódulos), e worktrees nas pastas de worktrees. Pula
// pastas ignoradas (node_modules, dist...) e as demais pastas ocultas.
export async function scanRepos(
  root: string,
  { depth, worktreeDirs }: ScanOptions,
): Promise<ScanResult> {
  const special = new Set(worktreeDirs.map((w) => path.resolve(w.dir)))
  const repos: string[] = []
  const linked: string[] = []
  let visited = 0
  const walk = async (dir: string, level: number): Promise<void> => {
    if (++visited > MAX_DIRS) return
    // A pasta aberta sendo ela mesma uma worktree é o workspace daquela worktree, não do
    // repositório principal dela.
    const found = await gitKind(dir)
    const kind = level === 0 && found === 'linked' ? null : found
    if (kind) (kind === 'repo' ? repos : linked).push(await realpath(dir))
    // Uma worktree não tem outros repositórios dentro que interessem.
    if (kind === 'linked' || level >= depth) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name) || e.name.startsWith('.')) continue
      const sub = path.join(dir, e.name)
      if (!special.has(path.resolve(sub))) await walk(sub, level + 1)
    }
  }
  // <pasta>/<tarefa>/<repo> (ou com menos níveis): só worktrees, não desce dentro delas.
  const walkWorktrees = async (dir: string, levels: number): Promise<void> => {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP.has(e.name)) continue
      if (++visited > MAX_DIRS) return
      const sub = path.join(dir, e.name)
      if ((await gitKind(sub)) === 'linked') linked.push(await realpath(sub))
      else if (levels > 1) await walkWorktrees(sub, levels - 1)
    }
  }
  // Primeiro as pastas de worktrees: são poucas e não podem ficar de fora pelo limite de pastas.
  for (const w of worktreeDirs) await walkWorktrees(w.dir, w.levels)
  await walk(root, 0)
  return { repos: [...new Set(repos)].sort(), linked: [...new Set(linked)].sort() }
}
