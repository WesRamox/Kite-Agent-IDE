import { AppException } from './errors'
import { t } from './i18n'

type RunGit = (cwd: string, args: string[]) => Promise<string>

// Barreira barata antes de chamar o git: nada que vire opção (-x), espaços nas pontas, bytes de
// controle ou nomes gigantes. O resto das regras é do próprio git (check-ref-format).
export function isSafeRefArg(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 200 &&
    !name.startsWith('-') &&
    name.trim() === name &&
    ![...name].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)
  )
}

// Allowlist estrita para nomes de branch base, que vêm da UI e entram em comandos sem o git
// validar antes (merge-base, diff).
const SIMPLE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/

export function isSimpleRefName(name: string): boolean {
  return SIMPLE_REF.test(name) && !name.includes('..')
}

// Nome de branch novo ou existente, validado pelo git. Lança INVALID_ARGS.
export async function assertBranchName(run: RunGit, cwd: string, branch: string): Promise<void> {
  const invalid = () => new AppException('INVALID_ARGS', t('error.invalidBranch', { branch }))
  if (!isSafeRefArg(branch)) throw invalid()
  try {
    await run(cwd, ['check-ref-format', '--branch', branch])
  } catch {
    throw invalid()
  }
}
