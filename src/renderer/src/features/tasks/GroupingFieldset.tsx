import type { TFunction } from '@shared/i18n'
import type { TaskGrouping, TaskGroupingMode } from '@shared/types'
import { useState } from 'react'
import { setGrouping } from './tasks.actions'
import { useT } from '../../lib/i18n'

// "Como agrupar" as worktrees em tarefas: na tela Descobrir (canvas, tela 4) e nas configurações.

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'

function modes(t: TFunction): { mode: TaskGroupingMode; title: string; desc: React.ReactNode }[] {
  return [
    { mode: 'auto', title: t('grouping.auto'), desc: t('grouping.autoDesc') },
    {
      mode: 'pattern',
      title: t('grouping.byPattern'),
      desc: (
        <>
          {t('grouping.example')}{' '}
          <span className="font-geist-mono">{t('grouping.examplePattern')}</span>
        </>
      ),
    },
    { mode: 'manual', title: t('grouping.manualTitle'), desc: t('grouping.manualDesc') },
  ]
}

export function GroupingFieldset({ grouping }: { grouping: TaskGrouping }) {
  const [pattern, setPattern] = useState(grouping.pattern)
  const t = useT()
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
      <legend className={`px-1.5 ${LABEL}`}>{t('grouping.legend')}</legend>
      {modes(t).map((m) => (
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
          aria-label={t('grouping.patternField')}
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
