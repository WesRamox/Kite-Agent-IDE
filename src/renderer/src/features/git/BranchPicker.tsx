import { ChevronDown, GitBranch } from 'lucide-react'
import { useState } from 'react'
import { checkout } from './git.actions'
import { useGitStore } from './git.store'
import { useT } from '../../lib/i18n'

export function BranchPicker() {
  const status = useGitStore((s) => s.status)
  const branches = useGitStore((s) => s.branches)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const t = useT()
  if (!status?.isRepo) return null

  const label = status.branch ?? `(${status.head ?? t('git.noCommits')})`
  const create = async () => {
    const branch = name.trim()
    if (!branch) return
    setOpen(false)
    setName('')
    await checkout(branch, true)
  }

  return (
    <div className="relative px-3">
      <button
        type="button"
        aria-label={t('git.switchBranch')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-left hover:bg-surface-2"
      >
        <GitBranch size={14} className="text-fg-muted" />
        <span className="flex-1 truncate">{label}</span>
        {(status.ahead > 0 || status.behind > 0) && (
          <span className="text-[11px] text-fg-muted">
            ↑{status.ahead} ↓{status.behind}
          </span>
        )}
        <ChevronDown size={14} className="text-fg-muted" />
      </button>
      {open && (
        <div className="absolute inset-x-3 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface-2 py-1 shadow-xl">
          <input
            autoFocus
            value={name}
            placeholder={t('git.newBranch')}
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create()
              if (e.key === 'Escape') setOpen(false)
            }}
            className="mx-2 mb-1 w-[calc(100%-1rem)] rounded border border-border bg-surface-0 px-2 py-0.5 text-fg outline-none focus:border-accent"
          />
          {branches.map((b) => {
            const busyElsewhere = !b.current && b.worktreePath !== null
            return (
              <button
                key={b.name}
                type="button"
                role="menuitem"
                disabled={b.current || busyElsewhere}
                title={busyElsewhere ? t('git.inUse', { path: b.worktreePath ?? '' }) : undefined}
                onClick={() => {
                  setOpen(false)
                  void checkout(b.name)
                }}
                className="flex w-full items-center gap-2 px-3 py-0.5 text-left enabled:hover:bg-accent/25 disabled:opacity-50"
              >
                <span className="flex-1 truncate">{b.name}</span>
                {b.current && <span className="text-[11px] text-accent">{t('git.current')}</span>}
                {busyElsewhere && (
                  <span className="text-[11px] text-fg-muted">{t('git.worktree')}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
