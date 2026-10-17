import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_IGNORED_NAMES } from './ignore-rules'

const SKIP = new Set([...DEFAULT_IGNORED_NAMES, '.worktrees'])
const MAX_DIRS = 2000

async function isRepo(dir: string): Promise<boolean> {
  // Repositório principal: `.git` é uma pasta. Em worktrees é um arquivo (essas vêm do git).
  return stat(path.join(dir, '.git')).then(
    (s) => s.isDirectory(),
    () => false,
  )
}

// Repositórios na pasta aberta: ela mesma e subpastas até `depth` níveis. Não desce dentro de
// um repositório nem em pastas ignoradas (node_modules, dist...).
export async function scanRepos(root: string, depth = 2): Promise<string[]> {
  const found: string[] = []
  let visited = 0
  const walk = async (dir: string, level: number): Promise<void> => {
    if (++visited > MAX_DIRS) return
    if (await isRepo(dir)) {
      found.push(await realpath(dir))
      return
    }
    if (level >= depth) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name) || e.name.startsWith('.')) continue
      await walk(path.join(dir, e.name), level + 1)
    }
  }
  await walk(root, 0)
  return found.sort()
}
