import type { AgentCli } from '@shared/types'

export const CLI_LABEL: Record<AgentCli, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
}

export const CLI_SHORT: Record<AgentCli, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
}

export const CLIS: AgentCli[] = ['claude', 'codex', 'gemini']

// Comando que retoma uma sessão de cada CLI (sem o id, para o rótulo do botão).
export const RESUME: Record<AgentCli, string> = {
  claude: 'claude --resume',
  codex: 'codex resume',
  gemini: 'gemini --resume',
}
