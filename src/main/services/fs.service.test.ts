import { readFile, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_EDITABLE_BYTES } from '../lib/file-content'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { FsService } from './fs.service'

describe('FsService', () => {
  let root: string
  let cleanup: () => Promise<void>
  let fs: FsService
  const trash = vi.fn(async (_p: string) => {})
  const p = (...parts: string[]): string => path.join(root, ...parts)

  beforeEach(async () => {
    const t = await makeTree({
      'ws/.gitignore': '*.log\n',
      'ws/b.ts': 'b',
      'ws/A.md': 'a',
      'ws/debug.log': 'x',
      'ws/src/index.ts': 'export {}',
      'ws/src/item10.ts': '',
      'ws/src/item2.ts': '',
      'ws/node_modules/x/index.js': '',
      'outside.txt': 'segredo',
    })
    cleanup = t.cleanup
    root = path.join(t.dir, 'ws')
    const guard = new WorkspaceGuard()
    await guard.addRoot(root)
    trash.mockClear()
    fs = new FsService({ guard, trash })
  })
  afterEach(() => cleanup())

  describe('readDir', () => {
    it('lista pastas antes de arquivos, ordem natural, sem ignorados', async () => {
      const names = (await fs.readDir(root)).map((e) => `${e.kind[0]}:${e.name}`)
      expect(names).toEqual(['d:src', 'f:.gitignore', 'f:A.md', 'f:b.ts'])
      const src = (await fs.readDir(p('src'))).map((e) => e.name)
      expect(src).toEqual(['index.ts', 'item2.ts', 'item10.ts'])
    })

    it('omite symlinks quebrados', async () => {
      // 'junction' dispensa o modo desenvolvedor no Windows; nos outros SOs é ignorado.
      await symlink(p('nao-existe'), p('quebrado'), 'junction')
      expect((await fs.readDir(root)).map((e) => e.name)).not.toContain('quebrado')
    })
  })

  describe('readFile', () => {
    it('lê texto', async () => {
      await expect(fs.readFile(p('src', 'index.ts'))).resolves.toEqual({
        content: 'export {}',
        encoding: 'utf8',
      })
    })

    it('recusa binários', async () => {
      await writeFile(p('img.png'), Buffer.from([0x89, 0x50, 0x00, 0x01]))
      await expect(fs.readFile(p('img.png'))).rejects.toMatchObject({ code: 'BINARY_FILE' })
    })

    it('recusa arquivos acima de 5 MB', async () => {
      await writeFile(p('big.txt'), Buffer.alloc(MAX_EDITABLE_BYTES + 1, 0x61))
      await expect(fs.readFile(p('big.txt'))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
    })

    it('recusa ler fora da raiz', async () => {
      await expect(fs.readFile(path.join(root, '..', 'outside.txt'))).rejects.toMatchObject({
        code: 'FORBIDDEN_PATH',
      })
    })
  })

  describe('writeFile', () => {
    it('grava preservando o BOM pedido', async () => {
      await fs.writeFile(p('A.md'), 'novo', 'utf8bom')
      const buf = await readFile(p('A.md'))
      expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      expect(buf.subarray(3).toString()).toBe('novo')
    })
  })

  describe('create / rename / delete', () => {
    it('cria arquivo e pasta', async () => {
      await fs.create(p('novo.ts'), 'file')
      await fs.create(p('pasta'), 'directory')
      expect((await stat(p('novo.ts'))).isFile()).toBe(true)
      expect((await stat(p('pasta'))).isDirectory()).toBe(true)
    })

    it('não sobrescreve ao criar', async () => {
      await expect(fs.create(p('b.ts'), 'file')).rejects.toMatchObject({ code: 'ALREADY_EXISTS' })
    })

    it('renomeia e recusa destino existente', async () => {
      await fs.rename(p('b.ts'), p('c.ts'))
      await expect(readFile(p('c.ts'), 'utf8')).resolves.toBe('b')
      await expect(fs.rename(p('c.ts'), p('A.md'))).rejects.toMatchObject({
        code: 'ALREADY_EXISTS',
      })
    })

    it('não renomeia para fora da raiz', async () => {
      await expect(fs.rename(p('b.ts'), path.join(root, '..', 'b.ts'))).rejects.toMatchObject({
        code: 'FORBIDDEN_PATH',
      })
    })

    it('exclui movendo para a lixeira', async () => {
      await fs.delete(p('b.ts'))
      expect(trash).toHaveBeenCalledWith(p('b.ts'))
    })

    it('não exclui a própria raiz', async () => {
      await expect(fs.delete(root)).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
      expect(trash).not.toHaveBeenCalled()
    })
  })

  describe('listFiles', () => {
    it('lista recursivamente sem ignorados', async () => {
      const { files, truncated } = await fs.listFiles(root)
      expect(truncated).toBe(false)
      expect(files.map((f) => path.relative(root, f)).sort()).toEqual(
        ['.gitignore', 'A.md', 'b.ts', 'src/index.ts', 'src/item10.ts', 'src/item2.ts'].map((f) =>
          f.split('/').join(path.sep),
        ),
      )
    })

    it('só aceita raízes abertas', async () => {
      await expect(fs.listFiles(p('src'))).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
    })
  })
})
