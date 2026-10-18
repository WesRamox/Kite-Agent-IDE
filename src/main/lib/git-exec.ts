import { AppException } from './errors'
import { MAX_EDITABLE_BYTES } from './file-content'
import { t } from './i18n'

// Executa `git <args>` em `cwd` e devolve o stdout. Falhas viram exceção com a mensagem do git.
// `env` extra é usado para autenticação (nunca vai para a linha de comando).
export type GitRunner = (
  cwd: string,
  args: string[],
  env?: Record<string, string>,
) => Promise<string>

// Roda o git convertendo qualquer falha em AppException('GIT_ERROR') com a mensagem limpa.
export async function execGit(
  run: GitRunner,
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): Promise<string> {
  try {
    return await run(cwd, args, env)
  } catch (err) {
    if (err instanceof AppException) throw err
    throw new AppException('GIT_ERROR', cleanGitMessage(err))
  }
}

// Conteúdo de um objeto (`rev:caminho`), ou vazio se ele não existe nessa versão.
export async function showOrEmpty(run: GitRunner, cwd: string, object: string): Promise<string> {
  let size: number
  try {
    size = Number((await execGit(run, cwd, ['cat-file', '-s', object])).trim())
  } catch {
    return '' // não existe nessa versão (novo, removido ou repositório sem commits)
  }
  if (size > MAX_EDITABLE_BYTES) throw new AppException('FILE_TOO_LARGE', t('error.fileTooLarge'))
  return execGit(run, cwd, ['show', object])
}

// Mensagem do git, sem prefixos e com no máximo algumas linhas.
export function cleanGitMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^(fatal|error|hint): /, '').trim())
    .filter((l) => l !== '')
  return lines.slice(0, 3).join(' ') || 'Erro do git'
}
