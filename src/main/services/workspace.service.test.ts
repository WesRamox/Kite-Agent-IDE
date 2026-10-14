import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { JsonStore } from '../lib/json-store'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { MAX_RECENT, WorkspaceService, type WorkspaceState } from './workspace.service'

describe('WorkspaceService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  let guard: WorkspaceGuard
  let picked: string | null
  let service: WorkspaceService
  const onRootClosed = vi.fn(async (_root: string) => {})

  beforeEach(async () => {
    ;({ dir, cleanup } = await makeTree({ 'a/': '', 'b/': '' }))
    guard = new WorkspaceGuard()
    picked = null
    onRootClosed.mockClear()
    service = new WorkspaceService({
      guard,
      store: new JsonStore<WorkspaceState>(
        path.join(dir, 'state.json'),
        z.object({ recent: z.array(z.string()) }),
        { recent: [] },
      ),
      pickFolder: async () => picked,
      onRootClosed,
    })
  })
  afterEach(() => cleanup())

  it('retorna null quando o diálogo é cancelado', async () => {
    await expect(service.openFolderDialog()).resolves.toBeNull()
    expect(guard.getRoots()).toEqual([])
  })

  it('abre a pasta escolhida, troca a raiz e registra nas recentes', async () => {
    picked = path.join(dir, 'a')
    await service.openFolderDialog()
    picked = path.join(dir, 'b')
    await service.openFolderDialog()
    expect(guard.getRoots()).toEqual([path.join(dir, 'b')])
    expect(onRootClosed).toHaveBeenCalledWith(path.join(dir, 'a'))
    await expect(service.recent()).resolves.toEqual([path.join(dir, 'b'), path.join(dir, 'a')])
  })

  it('só abre recentes que estão na lista', async () => {
    await expect(service.openRecent(path.join(dir, 'a'))).rejects.toMatchObject({
      code: 'FORBIDDEN_PATH',
    })
    picked = path.join(dir, 'a')
    await service.openFolderDialog()
    await expect(service.openRecent(path.join(dir, 'a'))).resolves.toBe(path.join(dir, 'a'))
  })

  it('limita e remove recentes', async () => {
    for (let i = 0; i < MAX_RECENT + 2; i++) {
      picked = path.join(dir, i % 2 ? 'a' : 'b')
      await service.openFolderDialog()
    }
    expect(await service.recent()).toHaveLength(2)
    await expect(service.removeRecent(path.join(dir, 'a'))).resolves.toEqual([path.join(dir, 'b')])
  })
})
