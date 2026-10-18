// @vitest-environment happy-dom
import type { DeviceFlowPoll } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installApi, ok } from '../../test/fake-api'
import { useGitStore } from '../git/git.store'
import { login } from './github.actions'
import { useGitHubStore } from './github.store'

const flow = {
  flowId: 'f1',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5,
}
const user = { login: 'octo', name: null, avatarUrl: '' }

function setup(polls: DeviceFlowPoll[]) {
  const pollDeviceFlow = vi.fn()
  for (const p of polls) pollDeviceFlow.mockResolvedValueOnce(ok(p))
  installApi({
    github: {
      startDeviceFlow: vi.fn(async () => ok(flow)),
      pollDeviceFlow,
      me: vi.fn(async () => ok({ configured: true, user, secureStorage: true })),
    },
    clipboard: { writeText: vi.fn(async () => ok(undefined)) },
  })
  return pollDeviceFlow
}

// Avança o relógio falso e deixa as promessas pendentes andarem.
const tick = (s: number) => vi.advanceTimersByTimeAsync(s * 1000)

describe('login (Device Flow)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGitHubStore.setState({ login: { kind: 'idle' }, auth: null })
    useGitStore.getState().reset(null)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('mostra o código, abre o navegador e conclui quando o usuário autoriza', async () => {
    const poll = setup([{ status: 'pending' }, { status: 'success', user }])
    const done = login()
    await tick(0)
    expect(useGitHubStore.getState().login).toEqual({ kind: 'waiting', flow })
    expect(window.open).toHaveBeenCalledWith(flow.verificationUri, '_blank')
    await tick(5)
    await tick(5)
    await done
    expect(poll).toHaveBeenCalledTimes(2)
    expect(useGitHubStore.getState().login).toEqual({ kind: 'idle' })
    expect(useGitHubStore.getState().auth?.user?.login).toBe('octo')
  })

  it('respeita o slow_down do GitHub', async () => {
    const poll = setup([
      { status: 'slow_down', interval: 10 },
      { status: 'success', user },
    ])
    const done = login()
    await tick(5)
    expect(poll).toHaveBeenCalledTimes(1)
    await tick(5)
    expect(poll).toHaveBeenCalledTimes(1)
    await tick(5)
    await done
    expect(poll).toHaveBeenCalledTimes(2)
  })

  it('acesso negado vira erro', async () => {
    setup([{ status: 'denied' }])
    const done = login()
    await tick(5)
    await done
    expect(useGitHubStore.getState().login).toMatchObject({ kind: 'error' })
  })

  it('um login novo cancela o anterior', async () => {
    const poll = setup([{ status: 'pending' }, { status: 'success', user }])
    const first = login()
    await tick(0)
    const second = login()
    await tick(5)
    // O primeiro acorda, vê que foi substituído e sai sem consultar.
    await first
    expect(poll).toHaveBeenCalledTimes(1)
    await tick(5)
    await second
    expect(poll).toHaveBeenCalledTimes(2)
    expect(useGitHubStore.getState().login).toEqual({ kind: 'idle' })
  })
})
