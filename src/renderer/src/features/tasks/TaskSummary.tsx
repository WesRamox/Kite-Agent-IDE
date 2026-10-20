import type { Task } from '@shared/types'
import { useT } from '../../lib/i18n'
import { join } from '../../lib/paths'
import { copySummaryRequest } from './tasks.actions'

const EMPTY = 'text-xs text-fg-muted'
const COPY =
  'h-[26px] rounded-md border border-border bg-transparent px-2.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg'

// Cor do card da regra pelo sinal da skill de regra de negócio: ✅ respeita, ❌ diverge, ⚠️ dúvida.
function ruleTone(rule: string[]): string {
  const first = rule[0] ?? ''
  if (first.startsWith('✅')) return 'border-success/40 bg-success/[0.08]'
  if (first.startsWith('❌')) return 'border-danger/40 bg-danger/[0.08]'
  if (first.startsWith('⚠')) return 'border-warning/40 bg-warning/[0.08]'
  return 'border-border bg-surface-0'
}

function Card({ lines, label, tone }: { lines: string[]; label: string; tone: string }) {
  return (
    <section
      aria-label={label}
      className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${tone}`}
    >
      {lines.map((line, i) => (
        <p key={i} className="text-xs leading-normal text-fg/90">
          {line}
        </p>
      ))}
    </section>
  )
}

// Botão com o pedido pronto para o agente escrever resumo e regra no TASK.md da tarefa.
function CopyRequest({ folder }: { folder: string }) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={() => copySummaryRequest(join(folder, 'TASK.md'))}
      className={COPY}
    >
      {t('details.summaryCopy')}
    </button>
  )
}

// Resumo da tarefa nos detalhes (fora do canvas, ver docs/decisions.md): o texto logo abaixo do
// título no TASK.md, num card só, na cor de destaque do tema. Sem resumo, oferece o pedido pronto
// para colar no agente.
export function TaskSummary({ task }: { task: Task }) {
  const t = useT()
  if (task.summary.length > 0)
    return (
      <Card
        lines={task.summary}
        label={t('details.summary')}
        tone="border-accent/35 bg-accent/[0.08]"
      />
    )
  if (!task.folder) return null
  return (
    <div className="flex flex-col items-start gap-2">
      <span className={EMPTY}>{t('details.summaryEmpty')}</span>
      <CopyRequest folder={task.folder} />
    </div>
  )
}

// Regra de negócio que a tarefa toca (seção "## Regra de negócio" do TASK.md), na cor do veredito.
export function TaskRule({ task }: { task: Task }) {
  const t = useT()
  if (task.rule.length > 0)
    return <Card lines={task.rule} label={t('details.rule')} tone={ruleTone(task.rule)} />
  if (!task.folder) return null
  return (
    <div className="flex flex-col items-start gap-2">
      <span className={EMPTY}>{t('details.ruleEmpty')}</span>
      {/* O pedido já está debaixo do resumo quando os dois faltam. */}
      {task.summary.length > 0 && <CopyRequest folder={task.folder} />}
    </div>
  )
}
