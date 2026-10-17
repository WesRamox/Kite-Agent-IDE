import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JsonStore } from '../lib/json-store'
import {
  DEFAULT_SETTINGS,
  settingsPatchSchema,
  settingsSchema,
  settingsSchemaWith,
} from '../lib/settings-schema'
import { makeTree } from '../test/tmp'
import { SettingsService } from './settings.service'

describe('SettingsService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  beforeEach(async () => ({ dir, cleanup } = await makeTree({})))
  afterEach(() => cleanup())

  const store = () => new JsonStore(path.join(dir, 's.json'), settingsSchema, DEFAULT_SETTINGS)

  it('começa no padrão, aplica o tema e persiste as trocas', async () => {
    const applyTheme = vi.fn()
    const svc = new SettingsService({ store: store(), applyTheme })
    await expect(svc.init()).resolves.toEqual(DEFAULT_SETTINGS)
    expect(applyTheme).toHaveBeenLastCalledWith('kite')

    await svc.setTheme('light')
    expect(applyTheme).toHaveBeenLastCalledWith('light')
    await svc.update({ editorFontSize: 15, notifications: false })
    const reopened = new SettingsService({ store: store(), applyTheme })
    await expect(reopened.init()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      editorFontSize: 15,
      notifications: false,
    })
  })

  it('idioma padrão vem de fora (do sistema) e a troca é aplicada no main', async () => {
    const applyLanguage = vi.fn()
    const defaults = { ...DEFAULT_SETTINGS, language: 'en' as const }
    const svc = new SettingsService({
      store: new JsonStore(path.join(dir, 's.json'), settingsSchemaWith(defaults), defaults),
      applyTheme: vi.fn(),
      applyLanguage,
      defaults,
    })
    await expect(svc.init()).resolves.toMatchObject({ language: 'en' })
    expect(applyLanguage).toHaveBeenLastCalledWith('en')
    await svc.update({ language: 'pt-BR' })
    expect(applyLanguage).toHaveBeenLastCalledWith('pt-BR')
  })

  it('arquivo antigo (só o tema) ou com um campo inválido mantém o resto', async () => {
    await writeFile(
      path.join(dir, 's.json'),
      JSON.stringify({ theme: 'paper', terminalFontSize: 99 }),
    )
    const svc = new SettingsService({ store: store(), applyTheme: vi.fn() })
    await expect(svc.init()).resolves.toEqual({ ...DEFAULT_SETTINGS, theme: 'paper' })
  })

  it('atualização do renderer só aceita campos conhecidos e válidos', () => {
    expect(settingsPatchSchema.safeParse({ terminalFontSize: 16 }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ terminalFontSize: 40 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ theme: 'light' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ language: 'en' }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ language: 'fr' }).success).toBe(false)
  })
})
