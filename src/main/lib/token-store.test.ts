import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeTree } from '../test/tmp'
import { TokenStore, type SecretCodec } from './token-store'

const fakeCodec = (available: boolean, backend: string | null): SecretCodec => ({
  isEncryptionAvailable: () => available,
  backend: () => backend,
  encryptString: (s) => Buffer.from(`enc:${Buffer.from(s).toString('base64')}`),
  decryptString: (b) => Buffer.from(b.toString().slice(4), 'base64').toString(),
})

describe('TokenStore', () => {
  let dir: string
  let cleanup: () => Promise<void>
  beforeEach(async () => ({ dir, cleanup } = await makeTree({})))
  afterEach(() => cleanup())

  it('grava criptografado e relê em outra instância', async () => {
    const file = path.join(dir, 'token.bin')
    await new TokenStore(file, fakeCodec(true, 'gnome_libsecret')).save('gho_segredo')
    expect((await readFile(file)).toString()).not.toContain('gho_segredo')
    await expect(new TokenStore(file, fakeCodec(true, 'gnome_libsecret')).load()).resolves.toBe(
      'gho_segredo',
    )
  })

  it('sem criptografia real, nunca grava em disco', async () => {
    const file = path.join(dir, 'token.bin')
    for (const codec of [fakeCodec(false, null), fakeCodec(true, 'basic_text')]) {
      const store = new TokenStore(file, codec)
      expect(store.isSecure()).toBe(false)
      await store.save('gho_x')
      await expect(store.load()).resolves.toBe('gho_x')
      await expect(stat(file)).rejects.toThrow()
    }
  })

  it('clear apaga memória e arquivo', async () => {
    const file = path.join(dir, 'token.bin')
    const store = new TokenStore(file, fakeCodec(true, null))
    await store.save('gho_x')
    await store.clear()
    await expect(store.load()).resolves.toBeNull()
    await expect(stat(file)).rejects.toThrow()
  })
})
