import type { Task } from '@shared/types'
import { useState } from 'react'
import { askAgent } from './review.actions'
import { useT } from '../../lib/i18n'

// "Pedir ajuste ao agente": o texto vai direto para o prompt da sessão ligada à tarefa.
export function AskAgentDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()
  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    const ok = await askAgent(task, text)
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/30 pt-[14vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label={t('ask.title')}
        className="flex h-fit w-[560px] flex-col gap-3 rounded-[10px] border border-border bg-surface-1 p-5 font-geist text-[13px] text-fg shadow-2xl"
      >
        <h2 className="text-base font-semibold">{t('ask.title')}</h2>
        <textarea
          autoFocus
          aria-label={t('ask.field')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
            if (e.key === 'Escape') onClose()
          }}
          rows={4}
          placeholder={t('ask.placeholder')}
          className="resize-y rounded-md border border-border bg-surface-0 px-2.5 py-2 text-fg placeholder:text-fg-muted/60 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-fg-muted">{t('ask.hint')}</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[7px] px-3 text-fg-muted hover:text-fg"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!text.trim() || busy}
            onClick={() => void send()}
            className="h-8 rounded-[7px] bg-accent px-3.5 font-semibold text-accent-fg hover:bg-accent/85 disabled:opacity-50"
          >
            {t('ask.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
