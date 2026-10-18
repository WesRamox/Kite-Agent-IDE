import { useT } from '../../lib/i18n'
import { useScmCandidates, useScmStore, useScmTarget } from './scm-target'

// Escolha do repositório dos painéis Git e GitHub, quando a tarefa (ou o workspace) tem mais
// de um. A escolha vale para os dois painéis.
export function RepoPicker() {
  const t = useT()
  const { context, candidates } = useScmCandidates()
  const target = useScmTarget()
  const pick = useScmStore((s) => s.pick)
  if (candidates.length < 2 || !target) return null
  return (
    <div className="px-3 pb-2">
      <select
        aria-label={t('git.repo')}
        value={target}
        onChange={(e) => pick(context, e.target.value)}
        className="h-7 w-full rounded-md border border-border bg-surface-0 px-2 font-geist-mono text-xs text-fg"
      >
        {candidates.map((c) => (
          <option key={c.path} value={c.path}>
            {c.detail ? `${c.name} · ${c.detail}` : c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
