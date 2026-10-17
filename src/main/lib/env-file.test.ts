import { describe, expect, it } from 'vitest'
import { loadEnvFiles, parseEnv } from './env-file'

describe('parseEnv', () => {
  it('lê chaves, aspas, export e comentários', () => {
    expect(
      parseEnv(
        [
          '# comentário',
          'GITHUB_CLIENT_ID=Ov23li123',
          'export GITHUB_HOST = "ghe.empresa.com"',
          "GITHUB_API_URL='https://ghe/api' ",
          'KITE_DEVTOOLS=1 # liga o devtools',
          'linha inválida',
          'VAZIA=',
        ].join('\n'),
      ),
    ).toEqual({
      GITHUB_CLIENT_ID: 'Ov23li123',
      GITHUB_HOST: 'ghe.empresa.com',
      GITHUB_API_URL: 'https://ghe/api',
      KITE_DEVTOOLS: '1',
      VAZIA: '',
    })
  })
})

describe('loadEnvFiles', () => {
  const files: Record<string, string> = {
    '/proj/.env': 'GITHUB_CLIENT_ID=do-projeto\nSEGREDO=x\n',
    '/perfil/.env': 'GITHUB_CLIENT_ID=do-perfil\nGITHUB_HOST=ghe\n',
  }
  const read = (f: string) => {
    const text = files[f]
    if (text === undefined) throw new Error('ENOENT')
    return text
  }

  it('só chaves conhecidas, o primeiro arquivo vence e arquivo ausente é ignorado', () => {
    const env: NodeJS.ProcessEnv = {}
    const res = loadEnvFiles(['/nada/.env', '/proj/.env', '/perfil/.env'], env, read)
    expect(env).toEqual({ GITHUB_CLIENT_ID: 'do-projeto', GITHUB_HOST: 'ghe' })
    expect(res).toEqual({
      files: ['/proj/.env', '/perfil/.env'],
      keys: ['GITHUB_CLIENT_ID', 'GITHUB_HOST'],
    })
  })

  it('variável já definida no ambiente vence o arquivo, mesmo vazia', () => {
    const env: NodeJS.ProcessEnv = { GITHUB_CLIENT_ID: '' }
    loadEnvFiles(['/perfil/.env'], env, read)
    expect(env).toEqual({ GITHUB_CLIENT_ID: '', GITHUB_HOST: 'ghe' })
  })
})
