// @vitest-environment happy-dom
import type { FileEncoding } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, installApi, ok } from '../../test/fake-api'

// Modelos do Monaco em memória: o que importa aqui é o fluxo, não o editor.
interface Fake {
  value: string
  savedContent: string
  encoding: FileEncoding
}
const models = new Map<string, Fake>()
vi.mock('./models', () => ({
  hasModel: (p: string) => models.has(p),
  getEntry: (p: string) => {
    const m = models.get(p)
    return (
      m && {
        model: { getValue: () => m.value },
        savedContent: m.savedContent,
        encoding: m.encoding,
      }
    )
  },
  isDirty: (p: string) => {
    const m = models.get(p)
    return m ? m.value !== m.savedContent : false
  },
  openPaths: () => [...models.keys()],
  createModel: (p: string, content: string, encoding: FileEncoding) =>
    models.set(p, { value: content, savedContent: content, encoding }),
  markSaved: (p: string, content: string) => {
    const m = models.get(p)
    if (m) m.savedContent = content
  },
  acknowledgeDisk: (p: string, content: string) => {
    const m = models.get(p)
    if (m) m.savedContent = content
  },
  replaceContent: (p: string, content: string) => {
    const m = models.get(p)
    if (m) Object.assign(m, { value: content, savedContent: content })
  },
  disposeModel: (p: string) => models.delete(p),
}))

const { handleExternalChange, resolveAllDirty, saveFile } = await import('./editor.actions')

const FILE = '/ws/a.ts'
const open = (saved: string, value = saved) =>
  models.set(FILE, { value, savedContent: saved, encoding: 'utf8' })

describe('editor: arquivo mudou no disco', () => {
  beforeEach(() => models.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('sem alterações locais, recarrega sem perguntar', async () => {
    open('v1')
    const confirm = vi.fn()
    installApi({
      fs: { readFile: vi.fn(async () => ok({ content: 'v2', encoding: 'utf8' })) },
      dialog: { confirm },
    })
    await handleExternalChange(FILE)
    expect(models.get(FILE)?.value).toBe('v2')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('com alterações locais, pergunta; "recarregar" troca o conteúdo', async () => {
    open('v1', 'meu')
    installApi({
      fs: { readFile: vi.fn(async () => ok({ content: 'v2', encoding: 'utf8' })) },
      dialog: { confirm: vi.fn(async () => ok(0)) },
    })
    await handleExternalChange(FILE)
    expect(models.get(FILE)).toMatchObject({ value: 'v2', savedContent: 'v2' })
  })

  it('com alterações locais, "manter as minhas" preserva o texto e segue não salvo', async () => {
    open('v1', 'meu')
    installApi({
      fs: { readFile: vi.fn(async () => ok({ content: 'v2', encoding: 'utf8' })) },
      dialog: { confirm: vi.fn(async () => ok(1)) },
    })
    await handleExternalChange(FILE)
    expect(models.get(FILE)).toMatchObject({ value: 'meu', savedContent: 'v2' })
  })

  it('eco do próprio salvamento não pergunta nem recarrega', async () => {
    open('v1', 'meu')
    const confirm = vi.fn()
    installApi({
      fs: { readFile: vi.fn(async () => ok({ content: 'v1', encoding: 'utf8' })) },
      dialog: { confirm },
    })
    await handleExternalChange(FILE)
    expect(models.get(FILE)?.value).toBe('meu')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('não abre duas perguntas para o mesmo arquivo', async () => {
    open('v1', 'meu')
    let answer: (v: ReturnType<typeof ok<number>>) => void = () => {}
    const confirm = vi.fn(() => new Promise<ReturnType<typeof ok<number>>>((r) => (answer = r)))
    installApi({
      fs: { readFile: vi.fn(async () => ok({ content: 'v2', encoding: 'utf8' })) },
      dialog: { confirm },
    })
    const first = handleExternalChange(FILE)
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    await handleExternalChange(FILE)
    answer(ok(1))
    await first
    expect(confirm).toHaveBeenCalledTimes(1)
  })
})

describe('editor: salvar', () => {
  beforeEach(() => models.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('grava com a codificação do arquivo e marca como salvo', async () => {
    models.set(FILE, { value: 'novo', savedContent: 'velho', encoding: 'utf8bom' })
    const writeFile = vi.fn(async () => ok(undefined))
    installApi({ fs: { writeFile } })
    expect(await saveFile(FILE)).toBe(true)
    expect(writeFile).toHaveBeenCalledWith(FILE, 'novo', 'utf8bom')
    expect(models.get(FILE)?.savedContent).toBe('novo')
  })

  it('falha ao gravar mantém o arquivo como não salvo', async () => {
    open('velho', 'novo')
    installApi({ fs: { writeFile: vi.fn(async () => fail('disco cheio')) } })
    expect(await saveFile(FILE)).toBe(false)
    expect(models.get(FILE)?.savedContent).toBe('velho')
  })

  it('trocar de workspace com arquivos não salvos: cancelar interrompe', async () => {
    open('v1', 'meu')
    installApi({ dialog: { confirm: vi.fn(async () => ok(2)) } })
    expect(await resolveAllDirty()).toBe(false)
  })

  it('trocar de workspace: "salvar tudo" grava cada arquivo', async () => {
    open('v1', 'meu')
    const writeFile = vi.fn(async () => ok(undefined))
    installApi({ dialog: { confirm: vi.fn(async () => ok(0)) }, fs: { writeFile } })
    expect(await resolveAllDirty()).toBe(true)
    expect(writeFile).toHaveBeenCalledTimes(1)
  })
})
