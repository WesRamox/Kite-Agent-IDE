import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppException } from '../lib/errors'
import { setLanguage } from '../lib/i18n'
import { createLogger } from '../lib/logger'
import { createHandler } from './handle'

const info = {
  name: 'x',
  version: '1.0.0',
  platform: 'linux',
  versions: { electron: '1', chrome: '1', node: '1' },
}
const silent = createLogger('test', 'error', () => {})

describe('createHandler', () => {
  it('retorna ok com os dados do handler', async () => {
    const h = createHandler('app:getInfo', z.tuple([]), () => info, silent)
    await expect(h([])).resolves.toEqual({ ok: true, data: info })
  })

  it('rejeita argumentos que não batem com o schema', async () => {
    const h = createHandler('app:getInfo', z.tuple([]), () => info, silent)
    const res = await h(['inesperado'])
    expect(res).toEqual({
      ok: false,
      error: { code: 'INVALID_ARGS', message: 'Argumentos inválidos' },
    })
  })

  it('converte AppException no erro de domínio', async () => {
    const h = createHandler(
      'app:getInfo',
      z.tuple([]),
      () => {
        throw new AppException('NOT_FOUND', 'sumiu')
      },
      silent,
    )
    await expect(h([])).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'sumiu' },
    })
  })

  it('esconde detalhes de erros inesperados', async () => {
    const h = createHandler(
      'app:getInfo',
      z.tuple([]),
      async () => {
        throw new Error('detalhe interno')
      },
      silent,
    )
    await expect(h([])).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno' },
    })
  })
  it('traduz erros do sistema no idioma atual, não no do carregamento', async () => {
    const h = createHandler(
      'app:getInfo',
      z.tuple([]),
      () => {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
      },
      silent,
    )
    try {
      setLanguage('en')
      await expect(h([])).resolves.toEqual({
        ok: false,
        error: { code: 'PERMISSION_DENIED', message: 'Permission denied' },
      })
      setLanguage('pt-BR')
      await expect(h([])).resolves.toMatchObject({ error: { message: 'Sem permissão' } })
    } finally {
      setLanguage('pt-BR')
    }
  })
})
