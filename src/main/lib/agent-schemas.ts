import { z } from 'zod'
import type { AgentPreset, AgentTask } from '@shared/types'
import type { AgentState } from '../services/agent.service'

export const presetSchema: z.ZodType<AgentPreset> = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(60),
  command: z.string().max(2000),
  promptMode: z.enum(['arg', 'type']),
  promptFlag: z.string().max(60),
})

const taskSchema: z.ZodType<AgentTask> = z.object({
  id: z.string(),
  name: z.string(),
  presetId: z.string(),
  presetName: z.string(),
  branch: z.string(),
  baseBranch: z.string(),
  worktreePath: z.string(),
  repoPath: z.string(),
  status: z.enum(['running', 'waiting', 'done', 'error']),
  alive: z.boolean(),
  interrupted: z.boolean(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  exitCode: z.number().nullable(),
  wsTaskId: z.string().optional(),
})

export const agentStateSchema: z.ZodType<AgentState> = z.object({
  presets: z.array(presetSchema),
  tasks: z.array(taskSchema),
})
