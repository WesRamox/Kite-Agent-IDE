import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { AppException } from './errors'

export function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function forbidden(): AppException {
  return new AppException('FORBIDDEN_PATH', 'Caminho fora das pastas abertas')
}

async function realpathOrNull(p: string): Promise<string | null> {
  try {
    return await realpath(p)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

// Mantém as raízes de workspace abertas pelo usuário e garante que toda operação de
// arquivo aconteça dentro delas, mesmo via `..` ou symlinks.
export class WorkspaceGuard {
  private readonly roots = new Set<string>()

  async addRoot(dir: string): Promise<string> {
    const real = await realpathOrNull(path.resolve(dir))
    if (!real) throw new AppException('NOT_FOUND', 'Pasta não encontrada')
    this.roots.add(real)
    return real
  }

  removeRoot(dir: string): void {
    this.roots.delete(dir)
  }

  getRoots(): string[] {
    return [...this.roots]
  }

  isRoot(dir: string): boolean {
    return this.roots.has(dir)
  }

  rootOf(target: string): string | undefined {
    return this.getRoots().find((root) => isInside(root, target))
  }

  // Caminho existente, seguindo symlinks: o destino real precisa estar numa raiz.
  async resolveExisting(input: string): Promise<string> {
    const lexical = this.checkLexical(input)
    const real = await realpathOrNull(lexical)
    if (!real) throw new AppException('NOT_FOUND', 'Arquivo ou pasta não encontrado')
    if (!this.rootOf(real)) throw forbidden()
    return real
  }

  // A própria entrada (pode não existir ainda, ou ser um symlink): o diretório pai real
  // precisa estar numa raiz. Usado para criar, renomear e excluir. A raiz em si é recusada.
  async resolveEntry(input: string): Promise<string> {
    const lexical = this.checkLexical(input)
    const parent = await realpathOrNull(path.dirname(lexical))
    if (!parent || !this.rootOf(parent)) throw forbidden()
    const resolved = path.join(parent, path.basename(lexical))
    if (this.roots.has(resolved)) throw forbidden()
    return resolved
  }

  private checkLexical(input: string): string {
    if (!path.isAbsolute(input) || input.includes('\0')) throw forbidden()
    const normalized = path.resolve(input)
    if (!this.rootOf(normalized)) throw forbidden()
    return normalized
  }
}
