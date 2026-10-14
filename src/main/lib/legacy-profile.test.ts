import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeTree } from '../test/tmp'
import { migrateLegacyProfile } from './legacy-profile'

describe('migrateLegacyProfile', () => {
  let dir: string
  let cleanup: () => Promise<void>
  beforeEach(
    async () =>
      ({ dir, cleanup } = await makeTree({
        'ai-controller/workspace.json': '{"recent":["/x"]}',
        'ai-controller/terminal-sessions/abc.json': '{}',
        'ai-controller/Cache/lixo': 'x',
      })),
  )
  afterEach(() => cleanup())

  it('copia só os arquivos do app, uma vez', async () => {
    const userData = path.join(dir, 'Kite')
    await mkdir(userData)
    expect(migrateLegacyProfile(dir, userData)).toEqual(['workspace.json', 'terminal-sessions'])
    await expect(readFile(path.join(userData, 'workspace.json'), 'utf8')).resolves.toContain('/x')
    await expect(
      readFile(path.join(userData, 'terminal-sessions', 'abc.json'), 'utf8'),
    ).resolves.toBe('{}')
    await expect(readFile(path.join(userData, 'Cache', 'lixo'))).rejects.toThrow()

    await writeFile(path.join(dir, 'ai-controller', 'workspace.json'), '{"recent":["/novo"]}')
    expect(migrateLegacyProfile(dir, userData)).toEqual([])
    await expect(readFile(path.join(userData, 'workspace.json'), 'utf8')).resolves.toContain('/x')
  })

  it('sem perfil antigo não faz nada', () => {
    expect(migrateLegacyProfile(path.join(dir, 'nada'), path.join(dir, 'Kite'))).toEqual([])
  })
})
