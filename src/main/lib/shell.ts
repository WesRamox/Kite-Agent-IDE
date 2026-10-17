import path from 'node:path'

export interface ShellEnv {
  platform: string
  env: Record<string, string | undefined>
  // Procura um executável no PATH (injetado para testes).
  which: (name: string) => string | null
}

export interface ShellSpec {
  file: string
  args: string[]
}

// Shell padrão do SO: $SHELL no Unix (login shell no macOS, como os terminais nativos);
// no Windows, pwsh se existir, senão o powershell embutido.
export function defaultShell({ platform, env, which }: ShellEnv): ShellSpec {
  if (platform === 'win32') {
    const pwsh = which('pwsh.exe')
    if (pwsh) return { file: pwsh, args: [] }
    const root = env['SystemRoot'] ?? 'C:\\Windows'
    return {
      file:
        which('powershell.exe') ??
        path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      args: [],
    }
  }
  const fallback = platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
  const file = env['SHELL'] && env['SHELL'].length > 0 ? env['SHELL'] : fallback
  return { file, args: platform === 'darwin' ? ['-l'] : [] }
}

// Variáveis do próprio app que não devem vazar para os shells (ex.: rodar `pnpm dev` de
// outro projeto Electron no terminal herdaria a URL do nosso renderer).
const INTERNAL_VARS = [
  'ELECTRON_RENDERER_URL',
  'ELECTRON_RUN_AS_NODE',
  'ELECTRON_NO_ATTACH_CONSOLE',
  'KITE_USER_DATA_DIR',
  'KITE_CLAUDE_SETTINGS',
  'LOG_LEVEL',
  // Marcadores de sessão do Claude Code: se o Kite for aberto de dentro de uma sessão do Claude
  // Code, um `claude` rodado no terminal do Kite se acharia uma sessão filha (sem salvar a
  // transcrição) e herdaria o token de mensagens da sessão de fora. Configurações do usuário
  // (ex.: CLAUDE_CODE_USE_BEDROCK) não estão na lista e continuam passando.
  'CLAUDECODE',
  'CLAUDE_PID',
  'CLAUDE_EFFORT',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SSE_PORT',
]

export function terminalEnv(
  base: Record<string, string | undefined>,
  extra: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && !INTERNAL_VARS.includes(k)) env[k] = v
  }
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'Kite',
    ...extra,
  }
}
