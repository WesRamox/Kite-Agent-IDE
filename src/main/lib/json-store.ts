import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'

let tmpCounter = 0

// Persistência simples em JSON, validada com zod. Escrita atômica (tmp + rename), uma de cada
// vez: gravações concorrentes são enfileiradas e a última vence.
export class JsonStore<T> {
  private queue: Promise<void> = Promise.resolve()

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

  write(value: T): Promise<void> {
    const json = JSON.stringify(value, null, 2)
    const run = async () => {
      await mkdir(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${process.pid}.${++tmpCounter}.tmp`
      await writeFile(tmp, json, 'utf8')
      await rename(tmp, this.file)
    }
    const next = this.queue.then(run, run)
    // A fila só precisa seguir; quem chamou recebe o erro pelo `next`.
    this.queue = next.catch(() => {})
    return next
  }
}
