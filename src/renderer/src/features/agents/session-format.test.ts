import type { AgentSession, AgentTask } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { sessionEvidence, sessionStatusLabel, tildePath, waitingCount } from './session-format'

const session = (patch: Partial<AgentSession> = {}): AgentSession => ({
  id: 's',
  cli: 'claude',
  cwd: '/home/ana/loja',
  status: 'running',
  waitReason: null,
  waitingSince: null,
  pending: null,
  lastMessage: null,
  firstPrompt: null,
  touchedPaths: [],
  touchedCount: 0,
  agentTaskId: null,
  startedAt: 0,
  lastEventAt: 0,
  endedAt: null,
  ...patch,
})

const task = (patch: Partial<AgentTask>): AgentTask =>
  ({ id: 't', alive: true, status: 'running', ...patch }) as AgentTask

describe('session-format', () => {
  it('rótulos de status', () => {
    expect(sessionStatusLabel(session({ status: 'waiting', waitReason: 'permission' }))).toBe(
      'pede permissão',
    )
    expect(sessionStatusLabel(session({ status: 'waiting', waitReason: 'turn' }))).toBe('sua vez')
    expect(sessionStatusLabel(session())).toBe('trabalhando')
  })

  it('abrevia a pasta pessoal', () => {
    expect(tildePath('/home/ana/loja')).toBe('~/loja')
    expect(tildePath('/Users/ana')).toBe('~')
    expect(tildePath('C:\\Users\\ana\\loja')).toBe('~\\loja')
    expect(tildePath('/homeless/x')).toBe('/homeless/x')
  })

  it('evidência: arquivos editados relativos ao cwd, ou o primeiro pedido', () => {
    expect(
      sessionEvidence(
        session({ touchedPaths: ['/home/ana/loja/.worktrees/PAY/api/a.ts'], touchedCount: 8 }),
      ),
    ).toBe('Editou .worktrees/PAY/api/a.ts e mais 7 arquivos.')
    expect(sessionEvidence(session({ touchedPaths: ['/tmp/x.ts'], touchedCount: 2 }))).toBe(
      'Editou /tmp/x.ts e mais 1 arquivo.',
    )
    expect(sessionEvidence(session({ firstPrompt: 'cria as worktrees' }))).toBe(
      'Ainda não tocou em nenhuma worktree. Primeiro pedido: “cria as worktrees”.',
    )
  })

  it('conta quem espera sem duplicar a sessão de um agente do Kite', () => {
    const sessions = [
      session({ id: 'a', status: 'waiting' }),
      session({ id: 'b', status: 'waiting', agentTaskId: 't' }),
      session({ id: 'c' }),
    ]
    expect(waitingCount(sessions, [task({ status: 'waiting' })])).toBe(2)
    // Agente do Kite já encerrado: a sessão conta por si.
    expect(waitingCount(sessions, [task({ alive: false })])).toBe(2)
  })
})
