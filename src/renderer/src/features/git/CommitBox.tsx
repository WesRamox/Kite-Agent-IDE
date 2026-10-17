import { Check } from 'lucide-react'
import { useState } from 'react'
import { isMac } from '../../lib/platform'
import { commit } from './git.actions'
import { useT } from '../../lib/i18n'

export function CommitBox({ stagedCount }: { stagedCount: number }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const disabled = busy || stagedCount === 0 || message.trim() === ''
  const t = useT()

  const submit = async () => {
    if (disabled) return
    setBusy(true)
    const ok = await commit(message)
    setBusy(false)
    if (ok) setMessage('')
  }

  return (
    <div className="flex flex-col gap-2 px-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (isMac ? e.metaKey : e.ctrlKey)) {
            e.preventDefault()
            void submit()
          }
        }}
        rows={3}
        spellCheck={false}
        placeholder={t('git.commitPlaceholder', { mod: isMac ? '⌘' : 'Ctrl+' })}
        className="resize-y rounded-md border border-border bg-surface-0 px-2 py-1.5 text-fg outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => void submit()}
        className="flex items-center justify-center gap-1.5 rounded-md bg-accent py-1 text-accent-fg enabled:hover:bg-accent/85 disabled:opacity-40"
      >
        <Check size={14} /> {t('git.commit')}
        {stagedCount > 0 ? ` (${stagedCount})` : ''}
      </button>
    </div>
  )
}
