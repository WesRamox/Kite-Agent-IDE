import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { TerminalSessionService } from './terminal-session.service'

describe('TerminalSessionService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  let guard: WorkspaceGuard
  let service: TerminalSessionService

  beforeEach(async () => {
    ;({ dir, cleanup } = await makeTree({ 'a/': '', 'b/': '' }))
    guard = new WorkspaceGuard()
    await guard.addRoot(path.join(dir, 'a'))
    await guard.addRoot(path.join(dir, 'b'))
    service = new TerminalSessionService(guard, path.join(dir, 'sessions'))
  })
  afterEach(() => cleanup())

  it('salva e carrega por workspace', async () => {
    await service.save(path.join(dir, 'a'), [{ title: 'T1', scrollback: 'ola' }])
    await expect(service.load(path.join(dir, 'a'))).resolves.toEqual([
      { title: 'T1', scrollback: 'ola' },
    ])
    await expect(service.load(path.join(dir, 'b'))).resolves.toEqual([])
  })

  it('recusa pastas que não são raízes abertas', async () => {
    await expect(service.load(path.join(dir, 'x'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
  })
})
