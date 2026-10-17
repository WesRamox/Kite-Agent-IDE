import { randomUUID } from 'node:crypto'
import type { DeviceFlowPoll, DeviceFlowStart, GitHubAuthState, GitHubUser } from '@shared/types'
import { AppException } from '../lib/errors'
import type { TokenStore } from '../lib/token-store'
import { t } from '../lib/i18n'

export const OAUTH_SCOPE = 'repo'

export interface GitHubAuthDeps {
  clientId: string | undefined
  // Base das rotas OAuth (https://github.com por padrão).
  oauthUrl: string
  fetch: typeof fetch
  tokens: TokenStore
  // Busca o usuário dono do token; lança AppException NOT_AUTHENTICATED se o token for inválido.
  fetchUser: (token: string) => Promise<GitHubUser>
}

interface Flow {
  deviceCode: string
  expiresAt: number
}

// OAuth Device Flow. O device_code fica só aqui; o renderer recebe um id opaco do fluxo.
export class GitHubAuthService {
  private readonly flows = new Map<string, Flow>()
  private user: GitHubUser | null = null

  constructor(private readonly deps: GitHubAuthDeps) {}

  async state(): Promise<GitHubAuthState> {
    const configured = !!this.deps.clientId
    const secureStorage = this.deps.tokens.isSecure()
    const token = await this.deps.tokens.load()
    if (!token) return { configured, user: null, secureStorage }
    if (!this.user) {
      try {
        this.user = await this.deps.fetchUser(token)
      } catch (err) {
        if (err instanceof AppException && err.code === 'NOT_AUTHENTICATED') {
          await this.logout() // token revogado ou expirado
          return { configured, user: null, secureStorage }
        }
        throw err
      }
    }
    return { configured, user: this.user, secureStorage }
  }

  async startDeviceFlow(): Promise<DeviceFlowStart> {
    const clientId = this.requireClientId()
    const data = await this.post('/login/device/code', { client_id: clientId, scope: OAUTH_SCOPE })
    const deviceCode = str(data['device_code'])
    const userCode = str(data['user_code'])
    const verificationUri = str(data['verification_uri'])
    if (!deviceCode || !userCode || !verificationUri) {
      throw new AppException(
        'GITHUB_ERROR',
        describeOAuthError(data, t('error.github.invalidResponse')),
      )
    }
    const expiresIn = num(data['expires_in'], 900)
    const flowId = randomUUID()
    this.flows.set(flowId, { deviceCode, expiresAt: Date.now() + expiresIn * 1000 })
    return { flowId, userCode, verificationUri, expiresIn, interval: num(data['interval'], 5) }
  }

  async pollDeviceFlow(flowId: string): Promise<DeviceFlowPoll> {
    const flow = this.flows.get(flowId)
    if (!flow || Date.now() > flow.expiresAt) {
      this.flows.delete(flowId)
      return { status: 'expired' }
    }
    const data = await this.post('/login/oauth/access_token', {
      client_id: this.requireClientId(),
      device_code: flow.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
    const token = str(data['access_token'])
    if (token) {
      this.flows.delete(flowId)
      const user = await this.deps.fetchUser(token)
      await this.deps.tokens.save(token)
      this.user = user
      return { status: 'success', user }
    }
    switch (data['error']) {
      case 'authorization_pending':
        return { status: 'pending' }
      case 'slow_down':
        return { status: 'slow_down', interval: num(data['interval'], 10) }
      case 'expired_token':
        this.flows.delete(flowId)
        return { status: 'expired' }
      case 'access_denied':
        this.flows.delete(flowId)
        return { status: 'denied' }
      default:
        this.flows.delete(flowId)
        throw new AppException(
          'GITHUB_ERROR',
          describeOAuthError(data, t('error.github.loginFailed')),
        )
    }
  }

  async logout(): Promise<void> {
    this.user = null
    await this.deps.tokens.clear()
  }

  async getToken(): Promise<string> {
    const token = await this.deps.tokens.load()
    if (!token) throw new AppException('NOT_AUTHENTICATED', t('error.github.signIn'))
    return token
  }

  private requireClientId(): string {
    if (!this.deps.clientId) {
      throw new AppException('NOT_CONFIGURED', t('error.github.notConfigured'))
    }
    return this.deps.clientId
  }

  private async post(
    route: string,
    body: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    let res: Response
    try {
      res = await this.deps.fetch(`${this.deps.oauthUrl}${route}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new AppException('GITHUB_ERROR', t('error.github.offline'))
    }
    const data: unknown = await res.json().catch(() => null)
    if (!data || typeof data !== 'object') {
      throw new AppException('GITHUB_ERROR', t('error.github.unexpected', { status: res.status }))
    }
    return data as Record<string, unknown>
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}

function describeOAuthError(data: Record<string, unknown>, fallback: string): string {
  const desc = str(data['error_description']) ?? str(data['error'])
  if (data['error'] === 'device_flow_disabled') {
    return t('error.github.deviceFlowDisabled')
  }
  if (data['error'] === 'incorrect_client_credentials') return t('error.github.badClientId')
  return desc ?? fallback
}
