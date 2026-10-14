import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Cria uma árvore temporária: chaves terminadas em '/' são pastas, as demais arquivos.
export async function makeTree(spec: Record<string, string>): Promise<{
  dir: string
  cleanup: () => Promise<void>
}> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'kite-')))
  for (const [rel, content] of Object.entries(spec)) {
    const full = path.join(dir, rel)
    if (rel.endsWith('/')) {
      await mkdir(full, { recursive: true })
    } else {
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, content)
    }
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}
