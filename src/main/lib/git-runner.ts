import { simpleGit } from 'simple-git'
import type { GitRunner } from '../services/git.service'
import { terminalEnv } from './shell'

// Editores e pagers interativos: o app nunca abre um, e sem eles o git não fica esperando.
const INTERACTIVE_VARS = [
  'EDITOR',
  'VISUAL',
  'GIT_EDITOR',
  'GIT_SEQUENCE_EDITOR',
  'PAGER',
  'GIT_PAGER',
  'GIT_EXTERNAL_DIFF',
]

export function gitEnv(base: Record<string, string | undefined>): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(terminalEnv(base)).filter(
      ([key]) => !INTERACTIVE_VARS.includes(key) && key !== 'TERM_PROGRAM',
    ),
  )
  return { ...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' }
}

// Runner real: simple-git em modo `raw`, sem prompts interativos e sem locks opcionais
// (sem isso, `git status` regrava .git/index e o watcher do .git entraria em ciclo).
// O ambiente vem do próprio usuário (não do renderer), então SSH, askpass e caminhos de
// config definidos por ele são permitidos.
export function createGitRunner(
  baseEnv: Record<string, string | undefined> = process.env,
): GitRunner {
  const base = gitEnv(baseEnv)
  return (cwd, args, extraEnv) => {
    const env = { ...base, ...extraEnv }
    return simpleGit({
      baseDir: cwd,
      trimmed: false,
      maxConcurrentProcesses: 6,
      allowEnvironment: Object.keys(env),
      unsafe: {
        allowUnsafeSshCommand: true,
        allowUnsafeAskPass: true,
        allowUnsafeConfigPaths: true,
        allowUnsafeConfigEnvCount: true,
        allowUnsafeGitProxy: true,
      },
    })
      .env(env)
      .raw(args)
  }
}
