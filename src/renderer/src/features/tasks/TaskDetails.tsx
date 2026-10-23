import type { PullSummary } from '@shared/types'
import { useState } from 'react'
import { CLI_SHORT } from '../../lib/agent-cli'
import { sessionStatusLabel, sessionTone, type SessionTone } from '../../lib/session-format'
import { useSessionsStore } from '../agents/sessions.store'
import { linkSessions } from '../../lib/task-links'
import { setTaskNotes } from './tasks.actions'
import { useActiveTask, useTasksStore, NO_LINKS } from './tasks.store'
import { TaskDoneActions } from './TaskDoneActions'
import { TaskRule, TaskSummary } from './TaskSummary'
import { t as tr, currentLang, useT } from '../../lib/i18n'

// Painel da direita da tarefa (canvas, tela 2: Task.dc.html, "Detalhes da tarefa").

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'
const DOT: Record<SessionTone, string> = {
  waiting: 'bg-accent',
  running: 'bg-info',
  muted: 'bg-fg-muted/50',
}
const TEXT: Record<SessionTone, string> = {
  waiting: 'text-accent',
  running: 'text-info',
  muted: 'text-fg-muted',
}

function clock(ts: number): string {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return today ? tr('details.since', { time: hm }) : `${d.toLocaleDateString(currentLang())} ${hm}`
}

export function TaskDetails() {
  const task = useActiveTask()
  const status = useTasksStore((s) => s.status)
  const prs = useTasksStore((s) => s.prs)
  const links = useTasksStore((s) => s.workspace?.sessionLinks ?? NO_LINKS)
  const sessions = useSessionsStore((s) => s.sessions)
  const t = useT()
  if (!task) return null

  const linked = linkSessions(sessions, [task], links)
  const mine = sessions.filter((s) => linked.get(s.id) === task.id)

  return (
    <aside
      aria-label={t('details.label')}
      className="flex w-[300px] shrink-0 flex-col gap-[18px] overflow-y-auto border-l border-border bg-surface-1 p-4 font-geist text-[13px] text-fg"
    >
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{t('details.task')}</span>
        <span className="text-[15px] font-semibold">{task.name}</span>
        <TaskDoneActions task={task} />
      </div>

      {(task.summary.length > 0 || task.folder) && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>{t('details.summary')}</span>
          <TaskSummary task={task} />
        </div>
      )}

      {(task.rule.length > 0 || task.folder) && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>{t('details.rule')}</span>
          <TaskRule task={task} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className={LABEL}>{t('details.repos')}</span>
        {task.worktrees.map((w) => {
          const st = status[w.path]
          const files = st?.isRepo ? st.files.length : null
          const ahead = st?.isRepo ? st.ahead : 0
          return (
            <div
              key={w.path}
              title={w.path}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-geist-mono font-medium">{w.repoName}</span>
                <PrBadge pr={prs[w.path]} />
              </div>
              <div className="text-xs text-fg-muted">
                {w.branch ?? t('details.noBranch', { head: w.head })}
              </div>
              {files !== null && (
                <div className="text-xs text-fg-muted">
                  {t('details.changed', { n: files })} ·{' '}
                  {ahead > 0 ? t('details.ahead', { n: ahead }) : t('details.nothingAhead')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL}>{t('details.sessions')}</span>
        {mine.length === 0 && (
          <span className="text-xs text-fg-muted">{t('details.noSessions')}</span>
        )}
        {mine.map((s) => {
          const tone = sessionTone(s)
          return (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className={`size-[7px] rounded-full ${DOT[tone]}`} />
              <span className={`flex-1 ${tone === 'muted' ? 'text-fg-muted' : ''}`}>
                {CLI_SHORT[s.cli]} · {clock(s.startedAt)}
              </span>
              <span className={TEXT[tone]}>{sessionStatusLabel(s)}</span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{t('details.notes')}</span>
        <NotesBox key={`${task.id}:${task.notes}`} taskId={task.id} initial={task.notes} />
      </div>
    </aside>
  )
}

function NotesBox({ taskId, initial }: { taskId: string; initial: string }) {
  const [notes, setNotes] = useState(initial)
  const t = useT()
  return (
    <textarea
      aria-label={t('details.notesLabel')}
      value={notes}
      placeholder={t('details.notesPlaceholder')}
      onChange={(e) => setNotes(e.target.value)}
      onBlur={() => notes !== initial && void setTaskNotes(taskId, notes)}
      rows={5}
      className="resize-y rounded-md border border-transparent bg-transparent p-0 text-xs leading-normal text-fg/80 placeholder:text-fg-muted/60 focus:border-border focus:bg-surface-0 focus:p-1.5 focus:outline-none"
    />
  )
}

// Status do PR da branch (canvas: "sem PR"). Sem GitHub ou sem login: nada.
function PrBadge({ pr }: { pr: PullSummary | null | undefined }) {
  const t = useT()
  if (pr === undefined) return null
  if (pr === null)
    return <span className="ml-auto text-[11px] text-fg-muted">{t('details.noPR')}</span>
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className={`ml-auto text-[11px] ${pr.state === 'open' ? 'text-success' : 'text-fg-muted'}`}
    >
      {t('details.pr', {
        number: pr.number,
        state: pr.draft ? t('details.pr.draft') : t(`details.pr.${pr.state}`),
      })}
    </a>
  )
}
