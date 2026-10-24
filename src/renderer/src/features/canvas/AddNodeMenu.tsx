import type { CanvasNodeData, CanvasNodeKind } from '@shared/types'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import {
  ChevronLeft,
  CodeXml,
  FileText,
  Globe,
  Plus,
  SquareTerminal,
  StickyNote,
  Terminal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useAgentsStore } from '../agents/agents.store'
import { isShownTask, useTasksStore } from '../tasks/tasks.store'
import { DEFAULT_BROWSER_URL, NODE_SIZE } from './canvas'
import { addNode, terminalCwd } from './canvas.actions'
import { useCanvasStore } from './canvas.store'

const KINDS: { kind: CanvasNodeKind; icon: LucideIcon }[] = [
  { kind: 'agent', icon: SquareTerminal },
  { kind: 'terminal', icon: Terminal },
  { kind: 'browser', icon: Globe },
  { kind: 'note', icon: StickyNote },
  { kind: 'summary', icon: FileText },
  { kind: 'code', icon: CodeXml },
]

const ROW =
  'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-3 disabled:opacity-50'
// Folga entre um bloco e o próximo.
const GAP = 80

// Botão "+" no canto, como no n8n: escolhe o tipo de bloco e, para agente e resumo, qual deles.
export function AddNodeMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [step, setStep] = useState<'kinds' | 'agent' | 'summary'>('kinds')
  const agents = useAgentsStore((s) => s.tasks)
  const tasks = useTasksStore((s) => s.workspace?.tasks)
  const flow = useStoreApi()
  const { setCenter } = useReactFlow()
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false)
    window.addEventListener('mousedown', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  // O primeiro bloco nasce no meio da tela; os outros, à direita do último (como no n8n), e a
  // vista desliza até ele.
  const add = (data: CanvasNodeData) => {
    const { width, height, transform } = flow.getState()
    const [tx, ty, zoom] = transform
    const size = NODE_SIZE[data.kind]
    const last = useCanvasStore.getState().nodes.at(-1)
    const position = last
      ? {
          x: last.position.x + (last.width ?? NODE_SIZE[last.data.kind].width) + GAP,
          y: last.position.y,
        }
      : {
          x: (width / 2 - tx) / zoom - size.width / 2,
          y: (height / 2 - ty) / zoom - size.height / 2,
        }
    addNode(data, position)
    if (last) {
      void setCenter(position.x + size.width / 2, position.y + size.height / 2, {
        zoom,
        duration: 450,
      })
    }
    onOpenChange(false)
    setStep('kinds')
  }

  const pick = (kind: CanvasNodeKind) => {
    const cwd = terminalCwd()
    if (kind === 'terminal') {
      if (cwd) add({ kind, cwd })
    } else if (kind === 'browser') add({ kind, url: DEFAULT_BROWSER_URL })
    else if (kind === 'code') add({ kind, language: 'typescript', text: '' })
    else if (kind === 'note') add({ kind, text: '' })
    else setStep(kind)
  }

  const visibleTasks = (tasks ?? []).filter(isShownTask)

  return (
    <div ref={ref} className="relative font-geist text-fg">
      <button
        type="button"
        aria-label={t('canvas.add')}
        title={t('canvas.add')}
        aria-expanded={open}
        onClick={() => {
          setStep('kinds')
          onOpenChange(!open)
        }}
        className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg shadow-lg transition-colors hover:border-accent hover:text-accent"
      >
        <Plus size={20} strokeWidth={2.2} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t('canvas.addTitle')}
          className="absolute top-12 right-0 max-h-[calc(100cqh-80px)] w-[min(320px,calc(100cqw-30px))] overflow-y-auto rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl"
        >
          {step === 'kinds' ? (
            <>
              <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
                {t('canvas.addTitle')}
              </p>
              {KINDS.map(({ kind, icon: Icon }) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(kind)}
                  className={ROW}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1 text-fg-muted group-hover:text-fg">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium">{t(`canvas.kind.${kind}`)}</span>
                    <span className="text-[11px] text-fg-muted">
                      {t(`canvas.kindHint.${kind}`)}
                    </span>
                  </span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('kinds')}
                className="flex items-center gap-1 px-2 pt-1 pb-2 text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase hover:text-fg"
              >
                <ChevronLeft size={13} />
                {step === 'agent' ? t('canvas.pickAgent') : t('canvas.pickTask')}
              </button>
              <div className="flex max-h-72 flex-col overflow-y-auto">
                {step === 'agent' &&
                  (agents.length === 0 ? (
                    <p className="px-2.5 pb-2 text-xs text-fg-muted">{t('canvas.noAgents')}</p>
                  ) : (
                    agents.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="menuitem"
                        onClick={() => add({ kind: 'agent', agentId: a.id })}
                        className={ROW}
                      >
                        <SquareTerminal size={14} className="shrink-0 text-fg-muted" />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{a.name}</span>
                        <span className="text-[11px] text-fg-muted">
                          {t(`canvas.agentStatus.${a.status}`)}
                        </span>
                      </button>
                    ))
                  ))}
                {step === 'summary' &&
                  (visibleTasks.length === 0 ? (
                    <p className="px-2.5 pb-2 text-xs text-fg-muted">{t('canvas.noTasks')}</p>
                  ) : (
                    visibleTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        role="menuitem"
                        onClick={() => add({ kind: 'summary', taskId: task.id })}
                        className={ROW}
                      >
                        <FileText size={14} className="shrink-0 text-fg-muted" />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{task.name}</span>
                        <span className="font-geist-mono text-[11px] text-fg-muted">
                          {task.key}
                        </span>
                      </button>
                    ))
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
