import path from 'node:path'
import type { AgentPreset } from '@shared/types'
import type { ShellSpec } from './shell'

// Aspas simples POSIX: nada dentro delas é interpretado; ' vira '\''.
export function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

// Aspas simples do PowerShell: ' vira ''.
export function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

// Linha de comando do agente, com o prompt como argumento quando o preset usa esse modo.
export function agentCommandLine(preset: AgentPreset, prompt: string, windows: boolean): string {
  const command = preset.command.trim()
  if (preset.promptMode !== 'arg' || prompt.trim() === '') return command
  const quoted = windows ? psQuote(prompt) : shQuote(prompt)
  const flag = preset.promptFlag.trim()
  return flag ? `${command} ${flag} ${quoted}` : `${command} ${quoted}`
}

// O comando do preset é o Claude Code (o único que hoje recebe as ferramentas do quadro).
export function isClaudeCommand(command: string): boolean {
  return /^(\S*[\\/])?claude(\.exe|\.cmd)?(\s|$)/i.test(command.trim())
}

// Claude Code: aponta o servidor de ferramentas do quadro do Kite. Vai no fim da linha: o
// --mcp-config aceita vários valores e engoliria o prompt se viesse antes dele.
export function withKiteTools(
  line: string,
  preset: AgentPreset,
  configPath: string | null,
  windows: boolean,
): string {
  if (!configPath || !isClaudeCommand(preset.command)) return line
  return `${line} --mcp-config ${windows ? psQuote(configPath) : shQuote(configPath)}`
}

// Roda a linha de comando no shell do usuário. No Unix, interativo + login (-ilc) para valer o
// PATH do .bashrc/.zshrc (CLIs instalados via nvm, por exemplo).
export function agentProcess(shell: ShellSpec, commandLine: string, platform: string): ShellSpec {
  if (platform === 'win32') {
    const exe = path.win32.basename(shell.file).toLowerCase()
    if (exe === 'cmd.exe') return { file: shell.file, args: ['/d', '/s', '/c', commandLine] }
    return { file: shell.file, args: ['-NoLogo', '-Command', commandLine] }
  }
  return { file: shell.file, args: ['-ilc', commandLine] }
}

// Nome de branch a partir do nome da tarefa: agent/<slug>.
export function taskSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return slug || 'tarefa'
}
