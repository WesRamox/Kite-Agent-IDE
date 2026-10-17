// Registro gravado no spool pelo kite-hook: só os campos que o Kite usa, com textos cortados.
// Sem dependências (roda a cada evento do agente e precisa ser rápido); o lado que lê o spool
// valida de novo com zod.

export interface HookRecord {
  v: 1
  ts: number
  cli: 'claude'
  event: string
  sessionId: string
  cwd: string
  agentId?: string
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
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/
const AGENT_ID = /^[0-9a-f-]{36}$/i

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string' || v === '') return undefined
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

function toolDetail(tool: string, input: Obj): string | undefined {
  if (tool === 'Bash') return str(input['command'], LIMITS.toolDetail)
  if (tool === 'WebFetch') return str(input['url'], LIMITS.toolDetail)
  return str(input['file_path'] ?? input['notebook_path'] ?? input['path'], LIMITS.toolDetail)
}

function editedPaths(tool: string, input: Obj): string[] | undefined {
  if (!EDIT_TOOLS.has(tool)) return undefined
  const p = input['file_path'] ?? input['notebook_path']
  return typeof p === 'string' && p.length <= 4096 ? [p] : undefined
}

export function toHookRecord(
  payload: unknown,
  env: Record<string, string | undefined>,
  now: number,
): HookRecord | null {
  if (!isObj(payload)) return null
  const sessionId = payload['session_id']
  const event = payload['hook_event_name']
  const cwd = payload['cwd']
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null
  if (typeof event !== 'string' || event.length > 64) return null
  if (typeof cwd !== 'string' || cwd.length > 4096) return null

  const rec: HookRecord = { v: 1, ts: now, cli: 'claude', event, sessionId, cwd }
  const agentId = env['KITE_AGENT_ID']
  if (agentId && AGENT_ID.test(agentId)) rec.agentId = agentId

  const tool = typeof payload['tool_name'] === 'string' ? payload['tool_name'].slice(0, 100) : null
  const input = isObj(payload['tool_input']) ? payload['tool_input'] : {}
  if (tool && (event === 'PreToolUse' || event === 'PermissionRequest')) {
    rec.tool = tool
    const detail = toolDetail(tool, input)
    if (detail) rec.toolDetail = detail
  }
  if (tool && event === 'PostToolUse') {
    rec.tool = tool
    const paths = editedPaths(tool, input)
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
