// @vitest-environment happy-dom
import type { AgentSession } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installApi, ok } from '../../test/fake-api'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { attentionItems } from './attention'

const openTerminal = vi.fn()
vi.mock('../terminal/terminal.actions', async (orig) => ({
  ...(await orig<object>()),
  openTerminal: (...args: unknown[]) => openTerminal(...args),
}))
const { resumeHere } = await import('./attention.actions')

const NOW = 1_000_000
function session(patch: Partial<AgentSession>): AgentSession {
  return {
    id: 's1',
    cli: 'claude',
    cwd: '/ws/api',
    status: 'waiting',
    waitReason: 'turn',
    waitingSince: NOW - 10,
    pending: null,
    activity: null,
    runningSince: null,
    lastMessage: null,
    firstPrompt: 'corrige o bug',
    touchedPaths: ['/ws/api/a.ts'],
    touchedCount: 1,
    agentTaskId: null,
    ptyId: null,
    startedAt: NOW - 100,
    lastEventAt: NOW - 10,
    endedAt: null,
    ...patch,
  }
}
// O item como a Central o monta.
const itemOf = (s: AgentSession) => {
  const [item] = attentionItems([s], [], NOW)
  if (!item) throw new Error('sessão não virou item')
  return item
}

describe('Retomar aqui', () => {
  beforeEach(() => {
    openTerminal.mockClear()
    useWorkspaceStore.setState({ root: '/ws' })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sessão encerrada no workspace: abre o resume num terminal na pasta dela', async () => {
    installApi({})
    await resumeHere(itemOf(session({ status: 'ended', endedAt: NOW - 5, waitReason: null })))
    expect(openTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/ws/api', input: 'claude --resume s1' }),
    )
  })

  it('sessão ainda aberta: pergunta antes, e cancelar não abre nada', async () => {
    const confirm = vi.fn(async () => ok(1))
    installApi({ dialog: { confirm } })
    await resumeHere(itemOf(session({})))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('sessão fora do workspace: copia o comando em vez de abrir terminal', async () => {
    const writeText = vi.fn(async () => ok(undefined))
    installApi({ clipboard: { writeText } })
    await resumeHere(itemOf(session({ cwd: '/outro/projeto' })))
    expect(writeText).toHaveBeenCalledWith('claude --resume s1')
    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('pasta com prefixo parecido não conta como dentro do workspace', async () => {
    const writeText = vi.fn(async () => ok(undefined))
    installApi({ clipboard: { writeText } })
    await resumeHere(itemOf(session({ cwd: '/ws-2/api', status: 'ended', endedAt: NOW - 5 })))
    expect(writeText).toHaveBeenCalled()
    expect(openTerminal).not.toHaveBeenCalled()
  })
})
