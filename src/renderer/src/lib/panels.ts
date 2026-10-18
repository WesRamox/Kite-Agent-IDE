// Ids dos painéis do dockview: terminais comuns e terminais de agente.
export const TERMINAL_PREFIX = 'terminal:'
export const AGENT_PREFIX = 'agent:'

export function isTerminalPanel(id: string): boolean {
  return id.startsWith(TERMINAL_PREFIX)
}

export function isAgentPanel(id: string): boolean {
  return id.startsWith(AGENT_PREFIX)
}

export function agentPanelId(taskId: string): string {
  return `${AGENT_PREFIX}${taskId}`
}
