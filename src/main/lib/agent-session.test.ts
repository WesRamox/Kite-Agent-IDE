import { describe, expect, it } from 'vitest'
import type { AgentSession } from '@shared/types'
import { hookRecordSchema, reduceSession } from './agent-session'
import type { HookRecord } from './hook-record'

let ts = 0
const rec = (event: string, extra: Partial<HookRecord> = {}): HookRecord => ({
  v: 1,
  ts: ++ts,
  cli: 'claude',
  event,
  sessionId: 's-1',
  cwd: '/w',
  ...extra,
})

function run(...recs: HookRecord[]): AgentSession {
  let s: AgentSession | undefined
  for (const r of recs) s = reduceSession(s, r)
  if (!s) throw new Error('sem eventos')
  return s
}

describe('reduceSession', () => {
  it('guarda as worktrees que o agente criou, a mais recente primeiro', () => {
    const s = run(
      rec('PreToolUse', {
        tool: 'Bash',
        toolDetail: 'cd SGE/be && git worktree add ../../.worktrees/T/be -b T origin/dev',
      }),
      rec('PreToolUse', {
        tool: 'Bash',
        toolDetail: 'git -C SGE/fe worktree add ../../.worktrees/T/fe',
      }),
      rec('PreToolUse', { tool: 'Bash', toolDetail: 'git status' }),
    )
    expect(s.createdWorktrees).toEqual(['/w/.worktrees/T/fe', '/w/.worktrees/T/be'])
  })

  it('nova sessão começa ociosa e trabalha ao receber um pedido', () => {
    const s = run(rec('SessionStart'), rec('UserPromptSubmit', { prompt: 'faça X' }))
    expect(s).toMatchObject({ status: 'running', firstPrompt: 'faça X', waitReason: null })
  })

  it('pedido de permissão espera com a ferramenta e volta a trabalhar depois', () => {
    const waiting = run(
      rec('UserPromptSubmit'),
      rec('PreToolUse', { tool: 'Bash' }),
      rec('PermissionRequest', { tool: 'Bash', toolDetail: 'pnpm test' }),
    )
    expect(waiting).toMatchObject({
      status: 'waiting',
      waitReason: 'permission',
      pending: { tool: 'Bash', detail: 'pnpm test' },
    })
    const back = reduceSession(waiting, rec('PostToolUse', { tool: 'Bash' }))
    expect(back).toMatchObject({ status: 'running', pending: null, waitingSince: null })
  })

  it('fim do turno espera com a última mensagem; idle_prompt não reinicia a espera', () => {
    const turn = run(rec('UserPromptSubmit'), rec('Stop', { lastMessage: 'Sigo para o Apple?' }))
    expect(turn).toMatchObject({
      status: 'waiting',
      waitReason: 'turn',
      lastMessage: 'Sigo para o Apple?',
    })
    const since = turn.waitingSince
    const idle = reduceSession(turn, rec('Notification', { notificationType: 'idle_prompt' }))
    expect(idle.waitingSince).toBe(since)
  })

  it('guarda a atividade atual e desde quando trabalha', () => {
    const s = run(
      rec('UserPromptSubmit'),
      rec('PreToolUse', { tool: 'Edit', toolDetail: '/w/a.ts' }),
    )
    expect(s.activity).toEqual({ tool: 'Edit', detail: '/w/a.ts' })
    const since = s.runningSince
    expect(since).not.toBeNull()
    const later = reduceSession(s, rec('PostToolUse', { tool: 'Edit' }))
    expect(later.runningSince).toBe(since)
    const stopped = reduceSession(later, rec('Stop'))
    expect(stopped).toMatchObject({ activity: null, runningSince: null })
  })

  it('conta arquivos editados sem repetir e guarda os mais recentes primeiro', () => {
    const s = run(
      rec('PostToolUse', { tool: 'Edit', paths: ['/w/a.ts'] }),
      rec('PostToolUse', { tool: 'Edit', paths: ['/w/b.ts'] }),
      rec('PostToolUse', { tool: 'Edit', paths: ['/w/a.ts'] }),
    )
    expect(s.touchedPaths).toEqual(['/w/a.ts', '/w/b.ts'])
    expect(s.touchedCount).toBe(2)
  })

  it('encerra e revive ao ser retomada', () => {
    const ended = run(rec('UserPromptSubmit'), rec('SessionEnd'))
    expect(ended).toMatchObject({ status: 'ended', endedAt: ts })
    expect(reduceSession(ended, rec('SessionStart'))).toMatchObject({
      status: 'idle',
      endedAt: null,
    })
  })

  it('liga a sessão ao agente do Kite e não altera o estado anterior', () => {
    const before = run(rec('SessionStart'))
    const after = reduceSession(
      before,
      rec('UserPromptSubmit', { agentId: '0f8fad5b-d9cb-469f-a165-70867728950e' }),
    )
    expect(after.agentTaskId).toBe('0f8fad5b-d9cb-469f-a165-70867728950e')
    expect(before.agentTaskId).toBeNull()
    expect(before.status).toBe('idle')
  })

  it('o schema rejeita linhas adulteradas', () => {
    expect(hookRecordSchema.safeParse(rec('Stop')).success).toBe(true)
    expect(hookRecordSchema.safeParse({ ...rec('Stop'), sessionId: '../../x' }).success).toBe(false)
    expect(hookRecordSchema.safeParse({ ...rec('Stop'), v: 2 }).success).toBe(false)
  })
})
