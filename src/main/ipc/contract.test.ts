import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// O contrato IPC é só tipo; este teste confere, pelo código-fonte, que cada canal declarado tem
// handler no main e função no preload (e que nada existe fora do contrato).
const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')
const tsFiles = (dir: string): string[] =>
  readdirSync(path.join(SRC, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => path.join(dir, f))

function keysOf(source: string, iface: string): Set<string> {
  const start = source.indexOf(`export interface ${iface} {`)
  const body = source.slice(start, source.indexOf('\n}', start))
  return new Set([...body.matchAll(/^ {2}'([a-zA-Z]+:[a-zA-Z]+)':/gm)].map((m) => m[1] ?? ''))
}

function matches(files: string[], re: RegExp): Set<string> {
  const found = new Set<string>()
  for (const f of files) for (const m of read(f).matchAll(re)) found.add(m[1] ?? '')
  return found
}

const contract = read('shared/ipc-contract.ts')
const preload = ['preload/index.ts']
const main = tsFiles('main')

describe('contrato IPC', () => {
  const invoke = keysOf(contract, 'InvokeChannels')
  const events = keysOf(contract, 'EventChannels')

  it('lê os canais do contrato', () => {
    expect(invoke.size).toBeGreaterThan(50)
    expect(events.size).toBeGreaterThan(5)
  })

  it('todo canal invoke tem handler no main', () => {
    const handled = matches(main, /registerHandler\(\s*'([a-zA-Z]+:[a-zA-Z]+)'/g)
    expect([...invoke].filter((c) => !handled.has(c))).toEqual([])
    expect([...handled].filter((c) => !invoke.has(c))).toEqual([])
  })

  it('todo canal invoke está exposto no preload', () => {
    const exposed = matches(preload, /invoke\('([a-zA-Z]+:[a-zA-Z]+)'\)/g)
    expect([...invoke].filter((c) => !exposed.has(c))).toEqual([])
    expect([...exposed].filter((c) => !invoke.has(c))).toEqual([])
  })

  it('todo evento é emitido pelo main e assinado no preload', () => {
    const emitted = matches(main, /(?:emit|send)\(\s*'([a-zA-Z]+:[a-zA-Z]+)'/g)
    const subscribed = matches(preload, /subscribe\('([a-zA-Z]+:[a-zA-Z]+)'\)/g)
    expect([...events].filter((c) => !emitted.has(c))).toEqual([])
    expect([...events].filter((c) => !subscribed.has(c))).toEqual([])
    expect([...subscribed].filter((c) => !events.has(c))).toEqual([])
  })
})
