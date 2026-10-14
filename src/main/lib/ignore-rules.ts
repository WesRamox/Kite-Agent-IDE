import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ignore, { type Ignore } from 'ignore'

export const DEFAULT_IGNORED_NAMES: readonly string[] = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
]

type ReadText = (file: string) => Promise<string | null>

const readTextOrNull: ReadText = async (file) => {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

// Decide se um caminho é ignorado: nomes padrão + todos os .gitignore entre a raiz e o
// diretório do caminho (regras de um .gitignore valem relativas à pasta dele).
export class IgnoreRules {
  private readonly cache = new Map<string, Promise<Ignore | null>>()

  constructor(
    private readonly root: string,
    private readonly readText: ReadText = readTextOrNull,
    private readonly ignoredNames: ReadonlySet<string> = new Set(DEFAULT_IGNORED_NAMES),
  ) {}

  async isIgnored(target: string, isDirectory: boolean): Promise<boolean> {
    if (this.ignoredNames.has(path.basename(target))) return true
    const rel = path.relative(this.root, target)
    if (rel === '' || rel.startsWith('..')) return false

    const parts = rel.split(path.sep)
    let dir = this.root
    for (let i = 0; i < parts.length; i++) {
      const rules = await this.rulesFor(dir)
      if (rules) {
        const sub = parts.slice(i).join('/') + (isDirectory ? '/' : '')
        if (rules.ignores(sub)) return true
      }
      dir = path.join(dir, parts[i] ?? '')
    }
    return false
  }

  // Chamado pelo watcher quando um .gitignore muda.
  invalidate(gitignorePath: string): void {
    this.cache.delete(path.dirname(gitignorePath))
  }

  private rulesFor(dir: string): Promise<Ignore | null> {
    let cached = this.cache.get(dir)
    if (!cached) {
      cached = this.readText(path.join(dir, '.gitignore')).then((text) =>
        text === null ? null : ignore().add(text),
      )
      this.cache.set(dir, cached)
    }
    return cached
  }
}
