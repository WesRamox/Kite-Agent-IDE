import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { makeTree } from '../test/tmp'
import { JsonStore } from './json-store'

describe('JsonStore', () => {
  let dir: string
  let cleanup: () => Promise<void>
  const schema = z.object({ recent: z.array(z.string()) })

  beforeEach(async () => ({ dir, cleanup } = await makeTree({})))
  afterEach(() => cleanup())

  it('retorna o fallback quando o arquivo não existe', async () => {
    const store = new JsonStore(path.join(dir, 'x.json'), schema, { recent: [] })
    await expect(store.read()).resolves.toEqual({ recent: [] })
  })

  it('grava e lê de volta, criando pastas', async () => {
    const store = new JsonStore(path.join(dir, 'a', 'b.json'), schema, { recent: [] })
    await store.write({ recent: ['/x'] })
    await expect(store.read()).resolves.toEqual({ recent: ['/x'] })
  })

  it('ignora conteúdo inválido', async () => {
    const file = path.join(dir, 'bad.json')
    await writeFile(file, '{"recent": 3}')
    const store = new JsonStore(file, schema, { recent: [] })
    await expect(store.read()).resolves.toEqual({ recent: [] })
  })
})
