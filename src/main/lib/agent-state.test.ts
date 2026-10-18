import { describe, expect, it } from 'vitest'
import type { AgentTask } from '@shared/types'
import { DEFAULT_PRESETS, mergePresets, restoreAgentState } from './agent-state'

describe('mergePresets', () => {
  it('sem nada salvo, devolve os padrões', () => {
    expect(mergePresets([])).toEqual(DEFAULT_PRESETS)
  })

  it('mantém a edição do usuário num padrão e os presets extras', () => {
    const claude = {
      ...DEFAULT_PRESETS.find((p) => p.id === 'claude'),
      id: 'claude',
      name: 'Claude Code',
      command: 'claude --model x',
      promptMode: 'arg' as const,
      promptFlag: '',
    }
    const extra = {
      id: 'aider',
      name: 'Aider',
      command: 'aider',
      promptMode: 'type' as const,
      promptFlag: '',
    }
    const merged = mergePresets([extra, claude])
    expect(merged.map((p) => p.id)).toEqual([...DEFAULT_PRESETS.map((p) => p.id), 'aider'])
    expect(merged[0]?.command).toBe('claude --model x')
  })

  it('padrão apagado pelo usuário volta', () => {
    const saved = DEFAULT_PRESETS.filter((p) => p.id !== 'codex')
    expect(mergePresets(saved).some((p) => p.id === 'codex')).toBe(true)
  })
})

describe('restoreAgentState', () => {
  const task: AgentTask = {
    id: 't1',
    name: 'x',
    presetId: 'claude',
    presetName: 'Claude Code',
    branch: 'agent/x',
    baseBranch: 'main',
    worktreePath: '/wt',
    repoPath: '/r',
    status: 'running',
    alive: true,
    interrupted: false,
    exitCode: null,
    startedAt: 1,
    endedAt: null,
  }

  it('marca como interrompido o agente que estava rodando', () => {
    const { tasks } = restoreAgentState({ presets: [], tasks: [task] }, 99)
    expect(tasks[0]).toMatchObject({
      alive: false,
      interrupted: true,
      status: 'error',
      endedAt: 99,
    })
  })

  it('não mexe em agente já encerrado', () => {
    const done = { ...task, alive: false, status: 'done' as const, endedAt: 5 }
    expect(restoreAgentState({ presets: [], tasks: [done] }, 99).tasks[0]).toEqual(done)
  })
})
