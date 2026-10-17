import { describe, expect, it } from 'vitest'
import {
  addKiteHooks,
  hasKiteHooks,
  HOOK_TARGETS,
  hookCommand,
  KITE_HOOK_EVENTS,
  kiteSnippet,
  removeKiteHooks,
  shQuote,
  wrapperScript,
} from './claude-settings'

const CMD = hookCommand('/home/u/.config/Kite/kite-hook.sh')
const other = { type: 'command', command: '/home/u/.orca/agent-hooks/claude-hook.sh', timeout: 10 }
const original = {
  theme: 'dark-ansi',
  enabledPlugins: { x: true },
  hooks: {
    Stop: [{ hooks: [other] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [other] }],
  },
}

describe('claude-settings', () => {
  it('adiciona os hooks do Kite em todos os eventos sem tocar nos outros', () => {
    const next = addKiteHooks(original, CMD)
    expect(hasKiteHooks(next)).toBe(true)
    expect(hasKiteHooks(original)).toBe(false)
    expect(next['theme']).toBe('dark-ansi')
    const hooks = next['hooks'] as Record<string, unknown[]>
    for (const event of KITE_HOOK_EVENTS) expect(hooks[event]?.length).toBeGreaterThan(0)
    expect(hooks['Stop']?.[0]).toEqual({ hooks: [other] })
    expect(hooks['PreToolUse']?.[0]).toEqual({ matcher: 'Bash', hooks: [other] })
    // Não altera a entrada.
    expect(original.hooks.Stop).toHaveLength(1)
  })

  it('é idempotente', () => {
    const once = addKiteHooks(original, CMD)
    expect(addKiteHooks(once, CMD)).toEqual(once)
  })

  it('remover devolve o original', () => {
    expect(removeKiteHooks(addKiteHooks(original, CMD))).toEqual(original)
    expect(removeKiteHooks(addKiteHooks({}, CMD))).toEqual({})
    expect(removeKiteHooks({ a: 1 })).toEqual({ a: 1 })
  })

  it('tira só o handler do Kite de um grupo compartilhado', () => {
    const mixed = {
      hooks: { Stop: [{ hooks: [other, { type: 'command', command: CMD }] }] },
    }
    expect(removeKiteHooks(mixed)).toEqual({ hooks: { Stop: [{ hooks: [other] }] } })
  })

  it('recusa formatos inesperados em vez de sobrescrever', () => {
    expect(() => addKiteHooks({ hooks: [] }, CMD)).toThrow()
    expect(() => addKiteHooks({ hooks: { Stop: {} } }, CMD)).toThrow()
  })

  it('comando e script são seguros com aspas no caminho', () => {
    expect(shQuote("/a b/it's")).toBe(`'/a b/it'\\''s'`)
    expect(CMD).toBe(
      `[ -x '/home/u/.config/Kite/kite-hook.sh' ] && '/home/u/.config/Kite/kite-hook.sh'; exit 0`,
    )
    const script = wrapperScript('/opt/Kite/kite', '/opt/Kite/kite-hook.js', '/data/agent-events')
    expect(script).toContain(
      `ELECTRON_RUN_AS_NODE=1 '/opt/Kite/kite' '/opt/Kite/kite-hook.js' '/data/agent-events' "$1" >/dev/null 2>&1`,
    )
    expect(script.trimEnd().endsWith('exit 0')).toBe(true)
  })

  it('Codex e Gemini: eventos, timeout e o CLI no comando', () => {
    const gemini = HOOK_TARGETS.gemini
    const cmd = hookCommand('/k/kite-hook.sh', 'gemini')
    expect(cmd).toBe(`[ -x '/k/kite-hook.sh' ] && '/k/kite-hook.sh' gemini; exit 0`)
    const next = addKiteHooks({}, cmd, gemini.events, gemini.timeout)
    expect(hasKiteHooks(next, gemini.events)).toBe(true)
    expect(hasKiteHooks(next)).toBe(false)
    expect(
      (next['hooks'] as Record<string, { hooks: { timeout: number }[] }[]>)['AfterAgent']?.[0]
        ?.hooks[0]?.timeout,
    ).toBe(10_000)
    expect(removeKiteHooks(next)).toEqual({})
    expect(hookCommand('/k/kite-hook.sh')).not.toContain('claude')
  })

  it('snippet lista todos os eventos', () => {
    const snippet = kiteSnippet('~/.config/Kite/kite-hook.sh')
    for (const event of KITE_HOOK_EVENTS) expect(snippet).toContain(`"${event}":`)
    expect(snippet.startsWith('"hooks": {')).toBe(true)
  })
})
