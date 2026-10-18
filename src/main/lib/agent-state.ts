import type { AgentPreset, AgentTask } from '@shared/types'

// Presets que vêm com o Kite; o usuário pode editar o comando de cada um e criar outros.
export const DEFAULT_PRESETS: AgentPreset[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude', promptMode: 'arg', promptFlag: '' },
  { id: 'codex', name: 'Codex', command: 'codex', promptMode: 'arg', promptFlag: '' },
  { id: 'gemini', name: 'Gemini CLI', command: 'gemini', promptMode: 'arg', promptFlag: '-i' },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', promptMode: 'type', promptFlag: '' },
  { id: 'custom', name: 'Comando customizado', command: '', promptMode: 'type', promptFlag: '' },
]

// Presets padrão sempre presentes (com o que o usuário editou por cima); extras do usuário
// são mantidos.
export function mergePresets(saved: AgentPreset[]): AgentPreset[] {
  const byId = new Map(saved.map((p) => [p.id, p]))
  const merged = DEFAULT_PRESETS.map((d) => ({ ...d, ...byId.get(d.id), id: d.id }))
  const extras = saved.filter((p) => !DEFAULT_PRESETS.some((d) => d.id === p.id))
  return [...merged, ...extras]
}

// Estado salvo ao abrir o app. Agentes que estavam rodando quando o app fechou ficam marcados como
// interrompidos (o processo não sobrevive ao app).
export function restoreAgentState(
  saved: { presets: AgentPreset[]; tasks: AgentTask[] },
  now: number,
): { presets: AgentPreset[]; tasks: AgentTask[] } {
  return {
    presets: mergePresets(saved.presets),
    tasks: saved.tasks.map((t) =>
      t.alive
        ? { ...t, alive: false, interrupted: true, status: 'error', endedAt: t.endedAt ?? now }
        : t,
    ),
  }
}
