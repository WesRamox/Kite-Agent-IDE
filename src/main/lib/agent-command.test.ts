import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import type { AgentPreset } from '@shared/types'
import {
  agentCommandLine,
  agentProcess,
  psQuote,
  shQuote,
  taskSlug,
  isClaudeCommand,
  withKiteTools,
} from './agent-command'

const preset = (over: Partial<AgentPreset> = {}): AgentPreset => ({
  id: 'x',
  name: 'X',
  command: 'claude',
  promptMode: 'arg',
  promptFlag: '',
  ...over,
})

describe('quoting', () => {
  it('shQuote sobrevive a aspas, $, ` e quebras de linha no sh real', () => {
    const nasty = `it's $HOME \`id\` "x" \\ ; rm -rf /\nlinha 2`
    if (process.platform !== 'win32') {
      expect(
        execFileSync('/bin/sh', ['-c', `printf %s ${shQuote(nasty)}`], { encoding: 'utf8' }),
      ).toBe(nasty)
    }
  })
  it('psQuote dobra aspas simples', () => {
    expect(psQuote("it's")).toBe("'it''s'")
  })
})

describe('agentCommandLine', () => {
  it('anexa o prompt como argumento, com flag opcional', () => {
    expect(agentCommandLine(preset(), 'faça X', false)).toBe(`claude 'faça X'`)
    expect(agentCommandLine(preset({ command: 'gemini', promptFlag: '-i' }), 'a', false)).toBe(
      `gemini -i 'a'`,
    )
  })
  it('não anexa nada no modo type ou com prompt vazio', () => {
    expect(agentCommandLine(preset({ promptMode: 'type' }), 'x', false)).toBe('claude')
    expect(agentCommandLine(preset(), '   ', false)).toBe('claude')
  })
})

describe('agentProcess', () => {
  it('usa -ilc no Unix e -Command no PowerShell', () => {
    expect(agentProcess({ file: '/bin/zsh', args: ['-l'] }, 'claude', 'darwin')).toEqual({
      file: '/bin/zsh',
      args: ['-ilc', 'claude'],
    })
    expect(agentProcess({ file: 'C:\\pwsh.exe', args: [] }, 'claude', 'win32').args).toEqual([
      '-NoLogo',
      '-Command',
      'claude',
    ])
  })
})

describe('taskSlug', () => {
  it('gera slugs seguros para nome de branch', () => {
    expect(taskSlug('Corrigir o Login (urgente!)')).toBe('corrigir-o-login-urgente')
    expect(taskSlug('Ação nº 2')).toBe('acao-n-2')
    expect(taskSlug('---')).toBe('tarefa')
  })
})

describe('withKiteTools', () => {
  const preset = (command: string) => ({
    id: 'p',
    name: 'P',
    command,
    promptMode: 'arg' as const,
    promptFlag: '',
  })

  it('só o Claude Code recebe as ferramentas do quadro, no fim da linha (depois do prompt)', () => {
    expect(isClaudeCommand('claude')).toBe(true)
    expect(isClaudeCommand('/home/x/.local/bin/claude --model opus')).toBe(true)
    expect(isClaudeCommand('claudette')).toBe(false)
    expect(isClaudeCommand('codex')).toBe(false)
    expect(withKiteTools("claude 'faz o pix'", preset('claude'), '/p/mcp/a.json', false)).toBe(
      "claude 'faz o pix' --mcp-config '/p/mcp/a.json'",
    )
    expect(withKiteTools('codex', preset('codex'), '/p/mcp/a.json', false)).toBe('codex')
    expect(withKiteTools('claude', preset('claude'), null, false)).toBe('claude')
  })

  it('o caminho vai entre aspas do shell certo', () => {
    expect(withKiteTools('claude', preset('claude'), "/p/o'k/a.json", false)).toBe(
      "claude --mcp-config '/p/o'\\''k/a.json'",
    )
    expect(withKiteTools('claude', preset('claude'), 'C:\\K\\a.json', true)).toBe(
      "claude --mcp-config 'C:\\K\\a.json'",
    )
  })
})
