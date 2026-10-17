// Registro gravado no spool pelo kite-hook: só os campos que o Kite usa, com textos cortados.
// Sem dependências (roda a cada evento do agente e precisa ser rápido); o lado que lê o spool
// valida de novo com zod.

export type HookCli = 'claude' | 'codex' | 'gemini'

export interface HookRecord {
  v: 1
  ts: number
  cli: HookCli
  event: string
  sessionId: string
  cwd: string
  agentId?: string
  // Terminal do Kite em que o agente roda (KITE_PTY_ID).
  ptyId?: string
  notificationType?: string
  message?: string
  tool?: string
  toolDetail?: string
  paths?: string[]
  lastMessage?: string
  prompt?: string
}

export const LIMITS = { message: 500, toolDetail: 500, lastMessage: 2000, prompt: 300, paths: 20 }

// Ferramentas que alteram arquivos: os caminhos delas viram "arquivos tocados".
// Claude Code: Edit/Write...; Gemini CLI: write_file/replace; Codex: apply_patch (caminhos no
// texto do patch).
const EDIT_TOOLS = new Set([
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
  'write_file',
  'replace',
  'edit',
])
const SHELL_TOOLS = new Set(['Bash', 'shell', 'local_shell', 'exec_command', 'run_shell_command'])

// Eventos do Gemini CLI com o nome equivalente do Claude Code (o Codex já usa os mesmos nomes).
const GEMINI_EVENTS: Record<string, string> = {
  SessionStart: 'SessionStart',
  SessionEnd: 'SessionEnd',
  BeforeAgent: 'UserPromptSubmit',
  AfterAgent: 'Stop',
  BeforeTool: 'PreToolUse',
  AfterTool: 'PostToolUse',
  Notification: 'Notification',
}
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/
// Ids gerados pelo Kite (randomUUID).
const AGENT_ID = /^[0-9a-f-]{36}$/i

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string' || v === '') return undefined
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

function command(input: Obj): unknown {
  const c = input['command'] ?? input['cmd']
  return Array.isArray(c) ? c.filter((x) => typeof x === 'string').join(' ') : c
}

// "*** Update File: a.ts" / "*** Add File: b.ts" no texto de um patch do Codex.
function patchPaths(input: Obj): string[] {
  const text = Object.values(input).find((v) => typeof v === 'string' && v.includes('*** '))
  if (typeof text !== 'string') return []
  const paths: string[] = []
  for (const m of text.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)) {
    const p = m[1]?.trim()
    if (p && p.length <= 4096) paths.push(p)
  }
  return paths.slice(0, LIMITS.paths)
}

function toolDetail(tool: string, input: Obj): string | undefined {
  if (SHELL_TOOLS.has(tool)) return str(command(input), LIMITS.toolDetail)
  if (tool === 'WebFetch') return str(input['url'], LIMITS.toolDetail)
  return str(
    input['file_path'] ?? input['notebook_path'] ?? input['absolute_path'] ?? input['path'],
    LIMITS.toolDetail,
  )
}

function editedPaths(tool: string, input: Obj, cwd: string): string[] | undefined {
  if (tool === 'apply_patch') {
    const paths = patchPaths(input).map((p) =>
      p.startsWith('/') ? p : `${cwd.replace(/\/$/, '')}/${p}`,
    )
    return paths.length > 0 ? paths : undefined
  }
  if (!EDIT_TOOLS.has(tool)) return undefined
  const p = input['file_path'] ?? input['notebook_path'] ?? input['absolute_path']
  return typeof p === 'string' && p.length <= 4096 ? [p] : undefined
}

export function toHookRecord(
  payload: unknown,
  env: Record<string, string | undefined>,
  now: number,
  cli: HookCli = 'claude',
): HookRecord | null {
  if (!isObj(payload)) return null
  if (cli === 'gemini') payload = fromGemini(payload, env)
  if (!isObj(payload)) return null
  const sessionId = payload['session_id']
  const event = payload['hook_event_name']
  const cwd = payload['cwd']
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null
  if (typeof event !== 'string' || event.length > 64) return null
  if (typeof cwd !== 'string' || cwd.length > 4096) return null

  const rec: HookRecord = { v: 1, ts: now, cli, event, sessionId, cwd }
  const agentId = env['KITE_AGENT_ID']
  if (agentId && AGENT_ID.test(agentId)) rec.agentId = agentId
  const ptyId = env['KITE_PTY_ID']
  if (ptyId && AGENT_ID.test(ptyId)) rec.ptyId = ptyId

  const tool = typeof payload['tool_name'] === 'string' ? payload['tool_name'].slice(0, 100) : null
  const input = isObj(payload['tool_input']) ? payload['tool_input'] : {}
  if (tool && (event === 'PreToolUse' || event === 'PermissionRequest')) {
    rec.tool = tool
    const detail = toolDetail(tool, input)
    if (detail) rec.toolDetail = detail
  }
  if (tool && event === 'PostToolUse') {
    rec.tool = tool
    const paths = editedPaths(tool, input, cwd)
    if (paths) rec.paths = paths
  }
  if (event === 'Notification') {
    const type = str(payload['notification_type'], 64)
    if (type) rec.notificationType = type
    const message = str(payload['message'], LIMITS.message)
    if (message) rec.message = message
  }
  if (event === 'Stop') {
    const last = str(payload['last_assistant_message'], LIMITS.lastMessage)
    if (last) rec.lastMessage = last
  }
  if (event === 'UserPromptSubmit') {
    const prompt = str(payload['prompt'], LIMITS.prompt)
    if (prompt) rec.prompt = prompt
  }
  return rec
}

// Payload do Gemini CLI no formato do Claude Code: nomes de evento, a resposta final
// (prompt_response) e o pedido de permissão (Notification "ToolPermission").
function fromGemini(p: Obj, env: Record<string, string | undefined>): Obj | null {
  const raw = typeof p['hook_event_name'] === 'string' ? p['hook_event_name'] : ''
  const event = GEMINI_EVENTS[raw]
  if (!event) return null
  const out: Obj = {
    ...p,
    hook_event_name: event,
    session_id: p['session_id'] ?? env['GEMINI_SESSION_ID'],
    cwd: p['cwd'] ?? env['GEMINI_CWD'],
  }
  if (raw === 'AfterAgent') out['last_assistant_message'] = p['prompt_response']
  if (raw === 'Notification' && p['notification_type'] === 'ToolPermission') {
    const details = isObj(p['details']) ? p['details'] : {}
    const tool = details['tool_name'] ?? details['toolName'] ?? details['name']
    out['hook_event_name'] = 'PermissionRequest'
    out['tool_name'] = typeof tool === 'string' ? tool : 'ferramenta'
    out['tool_input'] = isObj(details['tool_input'])
      ? details['tool_input']
      : { command: typeof p['message'] === 'string' ? p['message'] : '' }
  }
  return out
}
