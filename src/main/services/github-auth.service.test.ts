import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppException } from '../lib/errors'
import { TokenStore } from '../lib/token-store'
import { makeTree } from '../test/tmp'
import { GitHubAuthService } from './github-auth.service'

const codec = {
  isEncryptionAvailable: () => true,
  backend: () => null,
  encryptString: (s: string) => Buffer.from(s).reverse(),
  decryptString: (b: Buffer) => Buffer.from(b).reverse().toString(),
}

const USER = { login: 'octo', name: 'Octo', avatarUrl: '' }

describe('GitHubAuthService', () => {
  let dir: string
  let cleanup: () => Promise<void>
  let responses: Record<string, unknown>[]
  let requests: { url: string; body: Record<string, string> }[]
  let fetchUser: ReturnType<typeof vi.fn<(t: string) => Promise<typeof USER>>>

  const fakeFetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init?.body)) })
    const next = responses.shift() ?? {}
    return { status: 200, json: async () => next } as Response
  }) as typeof fetch

  const make = (clientId: string | null = 'cid') =>
    new GitHubAuthService({
      clientId: clientId ?? undefined,
      oauthUrl: 'https://gh.test',
      fetch: fakeFetch,
      tokens: new TokenStore(path.join(dir, 't.bin'), codec),
      fetchUser,
    })

  beforeEach(async () => {
    ;({ dir, cleanup } = await makeTree({}))
    responses = []
    requests = []
    fetchUser = vi.fn(async () => USER)
  })
  afterEach(() => cleanup())

  it('sem client id: não configurado', async () => {
    const svc = make(null)
    await expect(svc.state()).resolves.toMatchObject({ configured: false, user: null })
    await expect(svc.startDeviceFlow()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })

  it('fluxo completo: código, pendente, sucesso, e o token persiste', async () => {
    const svc = make()
    responses.push({
      device_code: 'dev-secreto',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    })
    const start = await svc.startDeviceFlow()
    expect(start).toMatchObject({ userCode: 'ABCD-1234', interval: 5 })
    expect(JSON.stringify(start)).not.toContain('dev-secreto')
    expect(requests[0]).toEqual({
      url: 'https://gh.test/login/device/code',
      body: { client_id: 'cid', scope: 'repo' },
    })

    responses.push({ error: 'authorization_pending' })
    await expect(svc.pollDeviceFlow(start.flowId)).resolves.toEqual({ status: 'pending' })
    responses.push({ error: 'slow_down', interval: 10 })
    await expect(svc.pollDeviceFlow(start.flowId)).resolves.toEqual({
      status: 'slow_down',
      interval: 10,
    })
    expect(requests[1]?.body).toMatchObject({ device_code: 'dev-secreto' })

    responses.push({ access_token: 'gho_abc', token_type: 'bearer' })
    await expect(svc.pollDeviceFlow(start.flowId)).resolves.toEqual({
      status: 'success',
      user: USER,
    })
    await expect(svc.getToken()).resolves.toBe('gho_abc')

    // Nova instância (app reaberto) encontra o token salvo.
    await expect(make().state()).resolves.toMatchObject({ configured: true, user: USER })
  })

  it('negado e expirado encerram o fluxo', async () => {
    const svc = make()
    responses.push({ device_code: 'd', user_code: 'U', verification_uri: 'v' })
    const { flowId } = await svc.startDeviceFlow()
    responses.push({ error: 'access_denied' })
    await expect(svc.pollDeviceFlow(flowId)).resolves.toEqual({ status: 'denied' })
    await expect(svc.pollDeviceFlow(flowId)).resolves.toEqual({ status: 'expired' })
    await expect(svc.pollDeviceFlow('inexistente')).resolves.toEqual({ status: 'expired' })
  })

  it('explica Device Flow desabilitado', async () => {
    responses.push({ error: 'device_flow_disabled' })
    await expect(make().startDeviceFlow()).rejects.toMatchObject({
      code: 'GITHUB_ERROR',
      message: expect.stringContaining('Device Flow'),
    })
  })

  it('token revogado faz logout', async () => {
    const tokens = new TokenStore(path.join(dir, 't.bin'), codec)
    await tokens.save('gho_velho')
    fetchUser.mockRejectedValueOnce(new AppException('NOT_AUTHENTICATED', 'x'))
    const svc = make()
    await expect(svc.state()).resolves.toMatchObject({ user: null })
    await expect(svc.getToken()).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' })
  })
})
