import type { Dirent } from 'node:fs'
import { lstat, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DirEntry, FileContent, FileEncoding } from '@shared/types'
import { AppException } from '../lib/errors'
import { decodeText, encodeText, looksBinary, MAX_EDITABLE_BYTES } from '../lib/file-content'
import { IgnoreRules } from '../lib/ignore-rules'
import type { WorkspaceGuard } from '../lib/workspace-guard'
import { t } from '../lib/i18n'

export const MAX_LISTED_FILES = 50_000

export interface FsServiceDeps {
  guard: WorkspaceGuard
  // Move para a lixeira do SO (shell.trashItem no Electron).
  trash: (target: string) => Promise<void>
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function sortEntries(a: DirEntry, b: DirEntry): number {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
  return collator.compare(a.name, b.name)
}

async function exists(p: string): Promise<boolean> {
  try {
    await lstat(p)
    return true
  } catch {
    return false
  }
}

export class FsService {
  private readonly ignoreByRoot = new Map<string, IgnoreRules>()

  constructor(private readonly deps: FsServiceDeps) {}

  async readDir(dir: string): Promise<DirEntry[]> {
    const real = await this.deps.guard.resolveExisting(dir)
    const base = path.resolve(dir)
    const rules = this.rulesFor(real)
    const dirents = await readdir(real, { withFileTypes: true })

    const entries = await Promise.all(
      dirents.map(async (d): Promise<DirEntry | null> => {
        const kind = await this.kindOf(d, path.join(real, d.name))
        if (!kind) return null
        if (await rules.isIgnored(path.join(real, d.name), kind === 'directory')) return null
        return { name: d.name, path: path.join(base, d.name), kind }
      }),
    )
    return entries.filter((e): e is DirEntry => e !== null).sort(sortEntries)
  }

  async readFile(file: string): Promise<FileContent> {
    const real = await this.deps.guard.resolveExisting(file)
    const info = await stat(real)
    if (!info.isFile()) throw new AppException('NOT_FOUND', t('error.notAFile'))
    if (info.size > MAX_EDITABLE_BYTES) {
      throw new AppException('FILE_TOO_LARGE', t('error.fileTooLarge'))
    }
    const buf = await readFile(real)
    if (looksBinary(buf)) throw new AppException('BINARY_FILE', t('error.binaryFile'))
    return decodeText(buf)
  }

  async writeFile(file: string, content: string, encoding: FileEncoding): Promise<void> {
    const target = (await exists(file))
      ? await this.deps.guard.resolveExisting(file)
      : await this.deps.guard.resolveEntry(file)
    await writeFile(target, encodeText(content, encoding))
  }

  async create(target: string, kind: 'file' | 'directory'): Promise<void> {
    const resolved = await this.deps.guard.resolveEntry(target)
    if (await exists(resolved)) throw new AppException('ALREADY_EXISTS', t('error.alreadyExists'))
    if (kind === 'directory') await mkdir(resolved)
    else await writeFile(resolved, '', { flag: 'wx' })
  }

  async rename(from: string, to: string): Promise<void> {
    const src = await this.deps.guard.resolveEntry(from)
    const dest = await this.deps.guard.resolveEntry(to)
    if (!(await exists(src))) throw new AppException('NOT_FOUND', t('error.notFound'))
    // Em FS sem diferenciação de maiúsculas, renomear só a caixa "colide" consigo mesmo.
    const caseOnly = src.toLowerCase() === dest.toLowerCase()
    if (!caseOnly && (await exists(dest)))
      throw new AppException('ALREADY_EXISTS', t('error.alreadyExists'))
    await rename(src, dest)
  }

  async delete(target: string): Promise<void> {
    const resolved = await this.deps.guard.resolveEntry(target)
    if (!(await exists(resolved))) {
      throw new AppException('NOT_FOUND', t('error.notFound'))
    }
    await this.deps.trash(resolved)
  }

  // Lista todos os arquivos não ignorados da raiz (para o quick open). Não segue symlinks
  // de diretório, evitando ciclos.
  async listFiles(root: string): Promise<{ files: string[]; truncated: boolean }> {
    if (!this.deps.guard.isRoot(root)) {
      throw new AppException('FORBIDDEN_PATH', t('error.notAnOpenFolder'))
    }
    const rules = this.rulesFor(root)
    const files: string[] = []
    const queue = [root]
    while (queue.length > 0) {
      const dir = queue.shift() as string
      let dirents: Dirent[]
      try {
        dirents = await readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const d of dirents) {
        const full = path.join(dir, d.name)
        if (d.isDirectory()) {
          if (!(await rules.isIgnored(full, true))) queue.push(full)
        } else if (d.isFile() || d.isSymbolicLink()) {
          if (await rules.isIgnored(full, false)) continue
          files.push(full)
          if (files.length >= MAX_LISTED_FILES) return { files, truncated: true }
        }
      }
    }
    return { files, truncated: false }
  }

  // O watcher avisa quando um .gitignore muda.
  invalidateIgnore(gitignorePath: string): void {
    const root = this.deps.guard.rootOf(gitignorePath)
    if (root) this.ignoreByRoot.get(root)?.invalidate(gitignorePath)
  }

  private rulesFor(target: string): IgnoreRules {
    const root = this.deps.guard.rootOf(target)
    if (!root) throw new AppException('FORBIDDEN_PATH', t('error.outsideRoots'))
    let rules = this.ignoreByRoot.get(root)
    if (!rules) {
      rules = new IgnoreRules(root)
      this.ignoreByRoot.set(root, rules)
    }
    return rules
  }

  private async kindOf(d: Dirent, full: string): Promise<DirEntry['kind'] | null> {
    if (d.isDirectory()) return 'directory'
    if (d.isFile()) return 'file'
    if (d.isSymbolicLink()) {
      try {
        return (await stat(full)).isDirectory() ? 'directory' : 'file'
      } catch {
        return null // symlink quebrado
      }
    }
    return null // sockets, FIFOs etc.
  }
}
