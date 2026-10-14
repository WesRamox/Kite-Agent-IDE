import { symlink } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeTree } from '../test/tmp'
import { isInside, WorkspaceGuard } from './workspace-guard'

describe('isInside', () => {
  it('aceita a própria raiz e descendentes', () => {
    expect(isInside('/a/b', '/a/b')).toBe(true)
    expect(isInside('/a/b', '/a/b/c/d')).toBe(true)
  })
  it('recusa irmãos com prefixo parecido e ancestrais', () => {
    expect(isInside('/a/b', '/a/bc')).toBe(false)
    expect(isInside('/a/b', '/a')).toBe(false)
  })
})

describe('WorkspaceGuard', () => {
  let root: string
  let outside: string
  let cleanup: () => Promise<void>
  let guard: WorkspaceGuard

  beforeEach(async () => {
    const t = await makeTree({ 'ws/a.txt': 'a', 'ws/sub/': '', 'secret/key.txt': 'k' })
    cleanup = t.cleanup
    root = path.join(t.dir, 'ws')
    outside = path.join(t.dir, 'secret')
    guard = new WorkspaceGuard()
    await guard.addRoot(root)
  })
  afterEach(() => cleanup())

  it('resolve arquivos dentro da raiz', async () => {
    await expect(guard.resolveExisting(path.join(root, 'a.txt'))).resolves.toBe(
      path.join(root, 'a.txt'),
    )
  })

  it('recusa caminhos relativos e fora da raiz', async () => {
    await expect(guard.resolveExisting('a.txt')).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
    await expect(guard.resolveExisting(path.join(outside, 'key.txt'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })

  it('recusa escapes via ..', async () => {
    const sneaky = `${root}${path.sep}..${path.sep}secret${path.sep}key.txt`
    await expect(guard.resolveExisting(sneaky)).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
    await expect(guard.resolveEntry(sneaky)).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
  })

  it('recusa symlinks que apontam para fora', async () => {
    const link = path.join(root, 'link')
    await symlink(outside, link)
    await expect(guard.resolveExisting(path.join(link, 'key.txt'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    await expect(guard.resolveEntry(path.join(link, 'novo.txt'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })

  it('permite operar no próprio symlink (entrada) dentro da raiz', async () => {
    const link = path.join(root, 'link')
    await symlink(outside, link)
    await expect(guard.resolveEntry(link)).resolves.toBe(link)
  })

  it('resolveEntry aceita arquivos ainda inexistentes, mas não a raiz', async () => {
    await expect(guard.resolveEntry(path.join(root, 'sub', 'novo.ts'))).resolves.toBe(
      path.join(root, 'sub', 'novo.ts'),
    )
    await expect(guard.resolveEntry(root)).rejects.toMatchObject({ code: 'FORBIDDEN_PATH' })
  })

  it('para de aceitar uma raiz removida', async () => {
    guard.removeRoot(root)
    await expect(guard.resolveExisting(path.join(root, 'a.txt'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })

  it('addRoot falha para pasta inexistente', async () => {
    await expect(guard.addRoot(path.join(root, 'nada'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
