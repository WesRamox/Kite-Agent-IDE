import { useEffect, useRef } from 'react'
import { basename } from '../../lib/paths'
import { isMac } from '../../lib/platform'
import { openReview } from './agents.actions'
import { touchedByRepo } from '../tasks/task-links'
import { openTaskReview } from '../tasks/review.actions'
import { openTask } from '../tasks/tasks.actions'
import {
  ago,
  chipLabel,
  doing,
  elapsed,
  groupItems,
  origin,
  shortKey,
  type AttentionItem,
} from './attention'
import { copyResume, respond, resumeHere } from './attention.actions'
import { useAttentionStore } from './attention.store'
import { useAttentionItems } from './use-attention'
import { useNow } from './use-now'

// Central de atenção (canvas, tela 1: Main.dc.html, área principal).

const SECTION_TITLE = 'text-[13px] font-semibold tracking-[0.06em] text-fg-muted uppercase'
const BTN = 'h-[34px] rounded-[7px] px-3.5'
const BTN_PRIMARY = `${BTN} bg-accent font-semibold text-accent-fg hover:bg-accent/85`
const BTN_SECONDARY = `${BTN} border border-border bg-surface-2 text-fg hover:bg-surface-3`

export function CentralPanel() {
  const items = useAttentionItems(15_000)
  const now = useNow(true, 15_000)
  const groups = groupItems(items)

  return (
    <div className="h-full overflow-y-auto bg-surface-0 font-geist text-[13px] text-fg">
      <div className="flex min-w-0 flex-col gap-7 px-9 py-7">
        <header className="flex flex-wrap items-end gap-4">
          <div className="flex-[1_1_320px]">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">Precisa de você</h1>
            <p className="mt-1.5 text-fg-muted">
              Agentes parados esperando uma resposta, em ordem de quem espera há mais tempo.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            Próximo que espera
            <kbd className="rounded border border-b-2 border-border bg-surface-2 px-1.5 py-0.5 font-geist-mono text-[11px] text-fg">
              {isMac ? '⌘J' : 'Ctrl+J'}
            </kbd>
          </div>
        </header>

        <section aria-label="Esperando você" className="flex flex-col gap-3.5">
          {groups.waiting.length === 0 ? (
            <p className="text-fg-muted">Nenhum agente esperando você agora.</p>
          ) : (
            groups.waiting.map((item) => <WaitingCard key={item.id} item={item} now={now} />)
          )}
        </section>

        {groups.running.length > 0 && (
          <section aria-label="Trabalhando" className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE}>Trabalhando · {groups.running.length}</h2>
            <div className="overflow-hidden rounded-[10px] border border-border">
              {groups.running.map((item, i) => (
                <Row key={item.id} item={item} first={i === 0} dot="bg-info">
                  <span className="flex-[2_1_260px] truncate text-fg-muted">{doing(item)}</span>
                  <span className="text-xs text-fg-muted tabular-nums">
                    {elapsed(now - item.since)}
                  </span>
                </Row>
              ))}
            </div>
          </section>
        )}

        {groups.review.length > 0 && (
          <section aria-label="Para revisar" className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE}>Para revisar · {groups.review.length}</h2>
            <div className="overflow-hidden rounded-[10px] border border-border">
              {groups.review.map((item, i) => (
                <Row key={item.id} item={item} first={i === 0} dot="bg-success">
                  <span className="flex-[2_1_260px] truncate text-fg-muted">
                    {reviewDetail(item, now)}
                  </span>
                  {(item.task || item.wsTask) && (
                    <button
                      type="button"
                      onClick={() =>
                        item.task
                          ? openReview(item.task.id)
                          : item.wsTask && void openTaskReview(item.wsTask.id)
                      }
                      className="h-[30px] rounded-[7px] border border-border bg-surface-2 px-3 text-fg hover:bg-surface-3"
                    >
                      Revisar
                    </button>
                  )}
                </Row>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function reviewDetail(item: AttentionItem, now: number): string {
  if (item.task) {
    return `Agente terminou ${ago(now - item.since)} · ${item.task.branch}`
  }
  const n = item.session?.touchedCount ?? 0
  const where = item.wsTask ? item.wsTask.worktrees.map((w) => w.repoName).join(' e ') : item.key
  return `Sessão terminou ${ago(now - item.since)} · ${where} · ${n} ${n === 1 ? 'arquivo' : 'arquivos'}`
}

function Row(props: {
  item: AttentionItem
  first: boolean
  dot: string
  children: React.ReactNode
}) {
  return (
    <div
      aria-label={`Tarefa ${props.item.name}`}
      className={`flex flex-wrap items-center gap-3 bg-surface-1 px-4 py-3 ${
        props.first ? '' : 'border-t border-border'
      }`}
    >
      <span className={`size-2 rounded-full ${props.dot}`} />
      <span className="w-16 truncate font-geist-mono text-xs text-fg-muted">
        {shortKey(props.item)}
      </span>
      <span className="flex-[1_1_200px] truncate font-medium">{props.item.name}</span>
      {props.children}
    </div>
  )
}

function WaitingCard({ item, now }: { item: AttentionItem; now: number }) {
  const highlighted = useAttentionStore((s) => s.highlighted === item.id)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlighted])
  const s = item.session
  const pending = item.waitReason === 'permission' ? s?.pending : null
  // Um chip por repo da tarefa, com os arquivos que os agentes editaram nele.
  const chips = item.wsTask
    ? Object.entries(touchedByRepo(item.wsTask, item.sessions)).map(([repo, changed]) => ({
        repo,
        changed,
      }))
    : [
        {
          repo: item.task ? basename(item.task.repoPath) : item.key,
          changed: s?.touchedCount ?? 0,
        },
      ]

  return (
    <article
      ref={ref}
      aria-label={`Tarefa ${item.name}`}
      className={`flex flex-col gap-3.5 rounded-[10px] border bg-surface-1 px-5 py-[18px] ${
        highlighted ? 'border-accent/60' : 'border-accent/20'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        {shortKey(item) && (
          <span className="font-geist-mono text-xs text-fg-muted">{item.key}</span>
        )}
        <h2 className="text-base font-semibold">{item.name}</h2>
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-accent/15 px-2 text-xs font-medium text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          {chipLabel(item)} · {ago(now - item.since)}
        </span>
        <span className="ml-auto text-xs text-fg-muted">{origin(item)}</span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-0 px-3.5 py-3">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
          {pending ? `Quer executar · ${pending.tool}` : 'Última mensagem do agente'}
        </span>
        {pending?.detail && (
          <code className="block rounded bg-surface-3 px-2 py-1.5 font-geist-mono text-[13px] break-all text-fg">
            {pending.detail}
          </code>
        )}
        <p className="leading-normal whitespace-pre-line text-fg/80">
          {message(item, pending !== null && pending !== undefined)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <span
            key={c.repo}
            className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 text-xs"
          >
            <span className="font-geist-mono">{c.repo}</span>
            {c.changed > 0 && (
              <span className="text-fg-muted">
                {c.changed} {c.changed === 1 ? 'alterado' : 'alterados'}
              </span>
            )}
          </span>
        ))}
        <span className="flex-1" />
        {item.inKite ? (
          <button type="button" onClick={() => respond(item)} className={BTN_PRIMARY}>
            Responder no terminal
          </button>
        ) : (
          <button type="button" onClick={() => void resumeHere(item)} className={BTN_PRIMARY}>
            Retomar aqui
          </button>
        )}
        {/* Como no desenho: agente no Kite → abrir a tarefa; fora dele → revisar as mudanças. */}
        {item.wsTask && (
          <button
            type="button"
            onClick={() =>
              item.wsTask &&
              void (item.inKite ? openTask(item.wsTask.id) : openTaskReview(item.wsTask.id))
            }
            className={BTN_SECONDARY}
          >
            {item.inKite ? 'Abrir tarefa' : 'Revisar mudanças'}
          </button>
        )}
        {item.task && (
          <button
            type="button"
            onClick={() => item.task && openReview(item.task.id)}
            className={BTN_SECONDARY}
          >
            Revisar mudanças
          </button>
        )}
        {!item.inKite && (
          <button
            type="button"
            aria-label="Copiar comando claude --resume"
            onClick={() => void copyResume(item)}
            className={`${BTN} border border-border bg-surface-2 px-3 font-geist-mono text-xs text-fg-muted hover:bg-surface-3`}
          >
            claude --resume
          </button>
        )}
      </div>
    </article>
  )
}

function message(item: AttentionItem, hasPending: boolean): string {
  const text = item.session?.lastMessage
  if (text) return `“${text}”`
  if (hasPending) return 'O agente precisa da sua permissão para continuar.'
  if (item.task && !item.session) return 'O agente parou e parece esperar uma resposta.'
  return 'O agente terminou o turno e espera o próximo pedido.'
}
