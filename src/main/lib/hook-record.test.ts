import { describe, expect, it } from 'vitest'
import { LIMITS, toHookRecord } from './hook-record'

const base = { session_id: 's-1', cwd: '/w', transcript_path: '/t.jsonl' }
const AGENT = '0f8fad5b-d9cb-469f-a165-70867728950e'

describe('toHookRecord', () => {
  it('rejeita payload sem sessão válida, evento ou cwd', () => {
    expect(toHookRecord(null, {}, 1)).toBeNull()
    expect(toHookRecord({ ...base, hook_event_name: 'Stop', session_id: '../x' }, {}, 1)).toBeNull()
    expect(toHookRecord({ ...base }, {}, 1)).toBeNull()
    expect(toHookRecord({ session_id: 's', hook_event_name: 'Stop' }, {}, 1)).toBeNull()
  })

  it('guarda o comando do pedido de permissão e o agente do Kite', () => {
    const rec = toHookRecord(
      {
        ...base,
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: { command: 'pnpm prisma migrate dev' },
      },
      { KITE_AGENT_ID: AGENT },
      5,
    )
    expect(rec).toEqual({
      v: 1,
      ts: 5,
      cli: 'claude',
      event: 'PermissionRequest',
      sessionId: 's-1',
      cwd: '/w',
      agentId: AGENT,
      tool: 'Bash',
      toolDetail: 'pnpm prisma migrate dev',
    })
  })

  it('guarda o terminal do Kite em que o agente roda', () => {
    const rec = toHookRecord({ ...base, hook_event_name: 'Stop' }, { KITE_PTY_ID: AGENT }, 1)
    expect(rec?.ptyId).toBe(AGENT)
  })

  it('ignora KITE_AGENT_ID malformado', () => {
    const rec = toHookRecord({ ...base, hook_event_name: 'Stop' }, { KITE_AGENT_ID: 'x;rm' }, 1)
    expect(rec?.agentId).toBeUndefined()
  })

  it('só registra caminhos de ferramentas que editam arquivos', () => {
    const edit = toHookRecord(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: '/w/a.ts' },
      },
      {},
      1,
    )
    expect(edit?.paths).toEqual(['/w/a.ts'])
    const read = toHookRecord(
      {
        ...base,
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/w/a.ts' },
      },
      {},
      1,
    )
    expect(read?.paths).toBeUndefined()
  })

  it('corta textos longos e não guarda conteúdo de ferramentas', () => {
    const rec = toHookRecord(
      {
        ...base,
        hook_event_name: 'Stop',
        last_assistant_message: 'x'.repeat(5000),
        tool_response: { content: 'segredo' },
      },
      {},
      1,
    )
    expect(rec?.lastMessage).toHaveLength(LIMITS.lastMessage)
    expect(JSON.stringify(rec)).not.toContain('segredo')
  })

  it('lê tipo e texto das notificações e o pedido do usuário', () => {
    const n = toHookRecord(
      {
        ...base,
        hook_event_name: 'Notification',
        notification_type: 'permission_prompt',
        message: 'Claude needs your permission',
      },
      {},
      1,
    )
    expect(n).toMatchObject({
      notificationType: 'permission_prompt',
      message: 'Claude needs your permission',
    })
    const p = toHookRecord(
      { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'cria as worktrees' },
      {},
      1,
    )
    expect(p?.prompt).toBe('cria as worktrees')
  })
})
