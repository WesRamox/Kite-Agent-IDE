import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Subconjunto do safeStorage do Electron (injetado para testes).
export interface SecretCodec {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
  // Só existe no Linux; 'basic_text' significa sem criptografia real.
  backend(): string | null
}

// Guarda o token criptografado em disco. Sem criptografia real disponível, mantém só em
// memória: o token nunca é gravado em texto puro.
export class TokenStore {
  private memory: string | null = null

  constructor(
    private readonly file: string,
    private readonly codec: SecretCodec,
  ) {}

  isSecure(): boolean {
    if (!this.codec.isEncryptionAvailable()) return false
    const backend = this.codec.backend()
    return backend === null || (backend !== 'basic_text' && backend !== 'unknown')
  }

  async load(): Promise<string | null> {
    if (this.memory) return this.memory
    if (!this.isSecure()) return null
    try {
      this.memory = this.codec.decryptString(await readFile(this.file))
      return this.memory
    } catch {
      return null
    }
  }

  async save(token: string): Promise<void> {
    this.memory = token
    if (!this.isSecure()) return
    await mkdir(path.dirname(this.file), { recursive: true })
    await writeFile(this.file, this.codec.encryptString(token), { mode: 0o600 })
  }

  async clear(): Promise<void> {
    this.memory = null
    await rm(this.file, { force: true })
  }
}
