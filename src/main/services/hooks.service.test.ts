import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLogger } from '../lib/logger'
import { makeTree } from '../test/tmp'
import { HooksService } from './hooks.service'

async function setup(settings?: string) {
  const t = await makeTree(
    settings === undefined ? { 'home/': '' } : { 'home/.claude/settings.json': settings },
  )
  const home = path.join(t.dir, 'home')
  const service = new HooksService({
    settingsPath: path.join(home, '.claude', 'settings.json'),
    wrapperPath: path.join(t.dir, 'data', 'kite-hook.sh'),
    wrapperContent: '#!/bin/sh\nexit 0\n',
    home,
    log: createLogger('test', 'error', () => {}),
  })
  const read = async () =>
    JSON.parse(await readFile(path.join(home, '.claude', 'settings.json'), 'utf8')) as unknown
  return { t, home, service, read }
}

describe('HooksService', () => {
  it('instala sem settings.json, cria o script e remove deixando o arquivo vazio', async () => {
    const s = await setup()
    expect((await s.service.status()).installed).toBe(false)
    const installed = await s.service.install()
    expect(installed).toMatchObject({
      installed: true,
      error: null,
      settingsPath: ['~', '.claude', 'settings.json'].join(path.sep),
    })
    expect(installed.snippet).toContain('"command": "kite-hook.sh"')
    const wrapper = await stat(path.join(s.t.dir, 'data', 'kite-hook.sh'))
    // O Windows não tem permissões POSIX: o modo é sempre 0o666.
    if (process.platform !== 'win32') expect(wrapper.mode & 0o777).toBe(0o700)
    expect((await s.service.uninstall()).installed).toBe(false)
    expect(await s.read()).toEqual({})
    await s.t.cleanup()
  })

  it('preserva o conteúdo existente, faz backup e volta ao original ao remover', async () => {
    const original = {
      theme: 'dark',
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'orca' }] }] },
    }
    const s = await setup(JSON.stringify(original))
    await s.service.install()
    const backup = await readFile(path.join(s.home, '.claude', 'settings.json.kite-backup'), 'utf8')
    expect(JSON.parse(backup)).toEqual(original)
    await s.service.uninstall()
    expect(await s.read()).toEqual(original)
    await s.t.cleanup()
  })

  it('não sobrescreve um settings.json inválido', async () => {
    const s = await setup('{ quebrado')
    expect((await s.service.status()).error).toBeTruthy()
    await expect(s.service.install()).rejects.toMatchObject({ code: 'INVALID_SETTINGS' })
    expect(await readFile(path.join(s.home, '.claude', 'settings.json'), 'utf8')).toBe('{ quebrado')
    await s.t.cleanup()
  })

  it('reescreve o script só quando o conteúdo muda', async () => {
    const s = await setup()
    await s.service.ensureWrapper()
    const file = path.join(s.t.dir, 'data', 'kite-hook.sh')
    await writeFile(file, 'antigo')
    await s.service.ensureWrapper()
    expect(await readFile(file, 'utf8')).toBe('#!/bin/sh\nexit 0\n')
    await s.t.cleanup()
  })
})
