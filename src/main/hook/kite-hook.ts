// Executado pelo Claude Code a cada evento de hook (via o script kite-hook.sh, com o binário do
// Electron em modo Node). Lê o JSON do stdin e acrescenta uma linha ao spool do Kite.
// Regras: nunca imprime nada (em alguns eventos a saída vira contexto do agente), sempre sai
// com código 0 e rápido, e nunca bloqueia o agente.
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { toHookRecord, type HookCli } from '../lib/hook-record'

const MAX_INPUT = 2 * 1024 * 1024
const spoolDir = process.argv[2]
// CLI que chamou o hook (o script repassa; sem argumento, Claude Code).
const cliArg = process.argv[3]
const cli: HookCli = cliArg === 'codex' || cliArg === 'gemini' ? cliArg : 'claude'

function finish(): never {
  process.exit(0)
}

// Se o stdin nunca fechar, sai mesmo assim.
setTimeout(finish, 5000).unref()

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => {
  input += chunk
  if (input.length > MAX_INPUT) finish()
})
process.stdin.on('error', finish)
process.stdin.on('end', () => {
  try {
    if (!spoolDir) finish()
    const rec = toHookRecord(JSON.parse(input), process.env, Date.now(), cli)
    if (rec) {
      mkdirSync(spoolDir, { recursive: true, mode: 0o700 })
      appendFileSync(path.join(spoolDir, `${rec.sessionId}.jsonl`), `${JSON.stringify(rec)}\n`, {
        mode: 0o600,
      })
    }
  } catch {
    // Evento malformado ou disco indisponível: o agente segue normalmente.
  }
  finish()
})
