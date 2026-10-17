import type { TaskGrouping, TaskGroupingMode } from '@shared/types'
import { useState } from 'react'
import { setGrouping } from './tasks.actions'

// "Como agrupar" as worktrees em tarefas: na tela Descobrir (canvas, tela 4) e nas configurações.

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'

const MODES: { mode: TaskGroupingMode; title: string; desc: React.ReactNode }[] = [
  {
    mode: 'auto',
    title: 'Automático',
    desc: 'Mesma pasta da tarefa ou mesmo nome de branch em repos diferentes',
  },
  {
    mode: 'pattern',
    title: 'Por padrão de pasta',
    desc: (
      <>
        Ex.:{' '}
        <span className="font-geist-mono">
          .worktrees/{'{tarefa}'}/{'{repo}'}
        </span>
      </>
    ),
  },
  { mode: 'manual', title: 'Manual', desc: 'Eu monto cada tarefa' },
]

export function GroupingFieldset({ grouping }: { grouping: TaskGrouping }) {
  const [pattern, setPattern] = useState(grouping.pattern)
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
      <legend className={`px-1.5 ${LABEL}`}>Como agrupar</legend>
      {MODES.map((m) => (
        <label key={m.mode} className="flex items-start gap-2.5 leading-[1.4]">
          <input
            type="radio"
            name="grouping"
            checked={grouping.mode === m.mode}
            onChange={() => void setGrouping({ mode: m.mode, pattern })}
            className="mt-[3px] accent-accent"
          />
          <span>
            <span className="block font-medium">{m.title}</span>
            <span className="text-xs text-fg-muted">{m.desc}</span>
          </span>
        </label>
      ))}
      {grouping.mode === 'pattern' && (
        <input
          aria-label="Padrão de pasta"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onBlur={() => void setGrouping({ mode: 'pattern', pattern })}
          onKeyDown={(e) => e.key === 'Enter' && void setGrouping({ mode: 'pattern', pattern })}
          className="h-[30px] rounded-md border border-border bg-surface-0 px-2.5 font-geist-mono text-xs text-fg"
        />
      )}
    </fieldset>
  )
}
