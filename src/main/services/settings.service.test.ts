import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { JsonStore } from '../lib/json-store'
import { makeTree } from '../test/tmp'
import { SettingsService } from './settings.service'

const schema = z.object({ theme: z.enum(['kite', 'dark', 'midnight', 'dimmed', 'light', 'paper']) })

describe('SettingsService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  beforeEach(async () => ({ dir, cleanup } = await makeTree({})))
  afterEach(() => cleanup())

  it('começa no tema padrão, aplica e persiste a troca', async () => {
    const applyTheme = vi.fn()
    const store = new JsonStore(path.join(dir, 's.json'), schema, { theme: 'kite' as const })
    const svc = new SettingsService({ store, applyTheme })
    await expect(svc.init()).resolves.toEqual({ theme: 'kite' })
    expect(applyTheme).toHaveBeenLastCalledWith('kite')

    await svc.setTheme('light')
    expect(applyTheme).toHaveBeenLastCalledWith('light')
    const reopened = new SettingsService({ store, applyTheme })
    await expect(reopened.init()).resolves.toEqual({ theme: 'light' })
  })
})
