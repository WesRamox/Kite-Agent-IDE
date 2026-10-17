import { z } from 'zod'
import type { AgentSession, WaitReason } from '@shared/types'
import { LIMITS, type HookRecord } from './hook-record'

// Validação das linhas do spool (escritas pelo kite-hook, mas o arquivo pode ter sido mexido).
export const hookRecordSchema: z.ZodType<HookRecord> = z.object({
  v: z.literal(1),
  ts: z.number().int().nonnegative(),
  cli: z.literal('claude'),
  event: z.string().min(1).max(64),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  cwd: z.string().max(4096),
  agentId: z.string().uuid().optional(),
  notificationType: z.string().max(64).optional(),
  message: z.string().max(LIMITS.message).optional(),
  tool: z.string().max(100).optional(),
  toolDetail: z.string().max(LIMITS.toolDetail).optional(),
  paths: z.array(z.string().max(4096)).max(LIMITS.paths).optional(),
  lastMessage: z.string().max(LIMITS.lastMessage).optional(),
  prompt: z.string().max(LIMITS.prompt).optional(),
})

const MAX_TOUCHED = 50
const INPUT_NOTIFICATIONS = new Set([
  'elicitation_dialog',
  'elicitation_url_dialog',
  'agent_needs_input',
])

function newSession(rec: HookRecord): AgentSession {
  return {
    id: rec.sessionId,
    cli: rec.cli,
    cwd: rec.cwd,
    status: 'idle',
    waitReason: null,
    waitingSince: null,
    pending: null,
    lastMessage: null,
    firstPrompt: null,
    touchedPaths: [],
    touchedCount: 0,
    agentTaskId: null,
    startedAt: rec.ts,
    lastEventAt: rec.ts,
    endedAt: null,
  }
}

function wait(s: AgentSession, reason: WaitReason, ts: number): void {
  if (s.status !== 'waiting' || s.waitReason !== reason) s.waitingSince = ts
  s.status = 'waiting'
  s.waitReason = reason
}

function work(s: AgentSession): void {
  s.status = 'running'
  s.waitReason = null
  s.waitingSince = null
  s.pending = null
}

function touch(s: AgentSession, paths: string[]): void {
  for (const p of paths) {
    const i = s.touchedPaths.indexOf(p)
    if (i >= 0) s.touchedPaths.splice(i, 1)
    else s.touchedCount++
    s.touchedPaths.unshift(p)
  }
  s.touchedPaths.length = Math.min(s.touchedPaths.length, MAX_TOUCHED)
}

// Aplica um evento de hook ao estado da sessão. Não altera `prev`.
export function reduceSession(prev: AgentSession | undefined, rec: HookRecord): AgentSession {
  const s: AgentSession = prev
    ? {
        ...prev,
        touchedPaths: [...prev.touchedPaths],
        pending: prev.pending && { ...prev.pending },
      }
    : newSession(rec)
  s.cwd = rec.cwd
  s.lastEventAt = Math.max(s.lastEventAt, rec.ts)
  if (rec.agentId) s.agentTaskId = rec.agentId
  // Sessão retomada depois de encerrada.
  if (s.status === 'ended' && rec.event !== 'SessionEnd') {
    s.status = 'idle'
    s.endedAt = null
  }

  switch (rec.event) {
    case 'SessionStart':
      if (s.status !== 'running' && s.status !== 'waiting') s.status = 'idle'
      break
    case 'UserPromptSubmit':
      work(s)
      s.firstPrompt ??= rec.prompt ?? null
      break
    case 'PreToolUse':
      work(s)
      break
    case 'PostToolUse':
      work(s)
      if (rec.paths) touch(s, rec.paths)
      break
    case 'PermissionRequest':
      wait(s, 'permission', rec.ts)
      s.pending = { tool: rec.tool ?? 'ferramenta', detail: rec.toolDetail ?? '' }
      break
    case 'Notification':
      if (rec.notificationType === 'permission_prompt') {
        wait(s, 'permission', rec.ts)
        if (rec.message) s.lastMessage = rec.message
      } else if (rec.notificationType === 'idle_prompt') {
        if (s.status !== 'waiting') wait(s, 'turn', rec.ts)
      } else if (rec.notificationType && INPUT_NOTIFICATIONS.has(rec.notificationType)) {
        wait(s, 'input', rec.ts)
        if (rec.message) s.lastMessage = rec.message
      }
      break
    case 'Stop':
      wait(s, 'turn', rec.ts)
      s.pending = null
      if (rec.lastMessage) s.lastMessage = rec.lastMessage
      break
    case 'SessionEnd':
      s.status = 'ended'
      s.waitReason = null
      s.waitingSince = null
      s.pending = null
      s.endedAt = rec.ts
      break
  }
  return s
}
