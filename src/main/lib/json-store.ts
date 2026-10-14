import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'

// Persistência simples em JSON, validada com zod. Escrita atômica (tmp + rename).
export class JsonStore<T> {
  constructor(
    private readonly file: string,
    private readonly schema: z.ZodType<T>,
    private readonly fallback: T,
  ) {}

  async read(): Promise<T> {
    try {
      const parsed = this.schema.safeParse(JSON.parse(await readFile(this.file, 'utf8')))
      return parsed.success ? parsed.data : this.fallback
    } catch {
      return this.fallback
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
    await rename(tmp, this.file)
  }
}
