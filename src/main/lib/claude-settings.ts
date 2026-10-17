// Merge dos hooks do Kite no settings.json do Claude Code. Funções puras: preservam qualquer
// outra chave e os hooks de outras ferramentas; os handlers do Kite são reconhecidos pelo
// caminho do script (kite-hook.sh) no comando.

export const KITE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Notification',
  'Stop',
  'SessionEnd',
] as const

export const KITE_HOOK_MARKER = 'kite-hook.sh'
const TIMEOUT_SECONDS = 10

export type Json = Record<string, unknown>

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isKiteHandler(handler: unknown): boolean {
  return (
    isObj(handler) &&
    typeof handler['command'] === 'string' &&
    handler['command'].includes(KITE_HOOK_MARKER)
  )
}

function hooksOf(settings: Json): Json {
  const hooks = settings['hooks']
  if (hooks === undefined) return {}
  if (!isObj(hooks)) throw new Error('"hooks" no settings.json não é um objeto')
  return hooks
}

// Tira os handlers do Kite de uma lista de grupos; grupos que ficam vazios saem.
function withoutKite(groups: unknown): unknown[] {
  if (!Array.isArray(groups)) return []
  const out: unknown[] = []
  for (const group of groups) {
    if (!isObj(group) || !Array.isArray(group['hooks'])) {
      out.push(group)
      continue
    }
    const handlers = group['hooks'].filter((h) => !isKiteHandler(h))
    if (handlers.length === group['hooks'].length) out.push(group)
    else if (handlers.length > 0) out.push({ ...group, hooks: handlers })
  }
  return out
}

export function hasKiteHooks(settings: Json): boolean {
  const hooks = hooksOf(settings)
  return KITE_HOOK_EVENTS.every((event) => {
    const groups = hooks[event]
    return (
      Array.isArray(groups) &&
      groups.some((g) => isObj(g) && Array.isArray(g['hooks']) && g['hooks'].some(isKiteHandler))
    )
  })
}

export function kiteHandler(command: string): Json {
  return { type: 'command', command, timeout: TIMEOUT_SECONDS }
}

// Instala (ou atualiza) os hooks do Kite. Idempotente.
export function addKiteHooks(settings: Json, command: string): Json {
  const next = structuredClone(settings)
  const hooks = structuredClone(hooksOf(settings))
  for (const event of KITE_HOOK_EVENTS) {
    const current = hooks[event]
    if (current !== undefined && !Array.isArray(current)) {
      throw new Error(`"hooks.${event}" no settings.json não é uma lista`)
    }
    hooks[event] = [...withoutKite(current), { hooks: [kiteHandler(command)] }]
  }
  next['hooks'] = hooks
  return next
}

// Remove só o que o Kite adicionou; listas e o objeto "hooks" que ficarem vazios saem.
export function removeKiteHooks(settings: Json): Json {
  if (settings['hooks'] === undefined) return structuredClone(settings)
  const next = structuredClone(settings)
  const hooks: Json = {}
  for (const [event, groups] of Object.entries(structuredClone(hooksOf(settings)))) {
    if (!Array.isArray(groups)) hooks[event] = groups
    else {
      const kept = withoutKite(groups)
      if (kept.length > 0) hooks[event] = kept
    }
  }
  if (Object.keys(hooks).length > 0) next['hooks'] = hooks
  else delete next['hooks']
  return next
}

// Trecho mostrado na tela de conectar: o que o Kite adiciona, com o comando abreviado.
export function kiteSnippet(displayCommand: string): string {
  const width = Math.max(...KITE_HOOK_EVENTS.map((e) => e.length)) + 3
  const lines = KITE_HOOK_EVENTS.map((event, i) => {
    const key = `"${event}":`.padEnd(width)
    const comma = i < KITE_HOOK_EVENTS.length - 1 ? ',' : ''
    return `  ${key} [{ "hooks": [{ "type": "command", "command": ${JSON.stringify(displayCommand)} }] }]${comma}`
  })
  return `"hooks": {\n${lines.join('\n')}\n}`
}

// Aspas de shell POSIX.
export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

// Comando gravado no settings.json: chama o script se ele existir e nunca falha, para que
// desinstalar o Kite sem remover os hooks não gere erro no agente.
export function hookCommand(wrapperPath: string): string {
  const q = shQuote(wrapperPath)
  return `[ -x ${q} ] && ${q}; exit 0`
}

// Script que repassa o evento ao kite-hook.js usando o binário do Electron como Node.
export function wrapperScript(execPath: string, scriptPath: string, spoolDir: string): string {
  return [
    '#!/bin/sh',
    '# Gerado pelo Kite: repassa eventos de hooks do Claude Code ao Kite. Nunca falha.',
    `ELECTRON_RUN_AS_NODE=1 ${shQuote(execPath)} ${shQuote(scriptPath)} ${shQuote(spoolDir)} >/dev/null 2>&1`,
    'exit 0',
    '',
  ].join('\n')
}
