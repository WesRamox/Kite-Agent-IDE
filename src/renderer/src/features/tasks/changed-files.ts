import type { GitChangeKind } from '@shared/types'

export interface ChangedFile {
  rel: string
  status: GitChangeKind
}

export interface ChangedDir {
  // Pasta relativa à worktree, com '/' no fim ('' = raiz da worktree).
  dir: string
  files: (ChangedFile & { name: string })[]
}

// Agrupa os alterados por pasta, como no explorer da tarefa em "Alterados": arquivos da raiz
// primeiro, depois as pastas em ordem alfabética, cada uma com os arquivos em ordem.
export function groupChanges(files: ChangedFile[]): ChangedDir[] {
  const byDir = new Map<string, ChangedDir['files']>()
  for (const f of files) {
    const slash = f.rel.lastIndexOf('/')
    const dir = slash < 0 ? '' : f.rel.slice(0, slash + 1)
    const list = byDir.get(dir) ?? []
    list.push({ ...f, name: f.rel.slice(slash + 1) })
    byDir.set(dir, list)
  }
  return [...byDir.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
    .map(([dir, list]) => ({ dir, files: list.sort((a, b) => a.name.localeCompare(b.name)) }))
}
