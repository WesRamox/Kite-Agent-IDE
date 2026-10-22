// Prefixos comuns de branch que não fazem parte do nome da tarefa.
const BRANCH_PREFIX = /^(feat|feature|fix|bugfix|hotfix|chore|refactor|agent|task|wip)\//i

// "feat/OPS-19" → "OPS-19": o agrupamento por branch (main) e as sugestões da descoberta
// (renderer) usam a mesma chave.
export function branchKey(branch: string): string {
  return branch.replace(BRANCH_PREFIX, '')
}
