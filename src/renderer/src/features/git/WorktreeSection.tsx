import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { basename } from '../../lib/paths'
import { createWorktree, openWorktree, removeWorktree } from './git.actions'
import { useGitStore } from './git.store'

export function WorktreeSection() {
  const worktrees = useGitStore((s) => s.worktrees)
  const branches = useGitStore((s) => s.branches)
  const [adding, setAdding] = useState(false)
  const [branch, setBranch] = useState('')

  const trimmed = branch.trim()
  const existing = branches.find((b) => b.name === trimmed)

  const submit = async () => {
    if (!trimmed) return
    const created = await createWorktree(trimmed)
    if (created) {
      setBranch('')
      setAdding(false)
    }
  }

  return (
    <section className="mt-3" aria-label="Worktrees">
      <header className="flex h-6 items-center px-3 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
        <span className="flex-1">
          Worktrees{' '}
          <span className="ml-1 rounded bg-surface-3 px-1.5 font-normal">{worktrees.length}</span>
        </span>
        <button
          type="button"
          title="Nova worktree"
          aria-label="Nova worktree"
          onClick={() => setAdding((a) => !a)}
          className="rounded p-0.5 hover:bg-surface-3 hover:text-fg"
        >
          <Plus size={14} />
        </button>
      </header>

      {adding && (
        <div className="flex flex-col gap-1 px-3 pb-2">
          <input
            autoFocus
            value={branch}
            placeholder="Branch da worktree"
            spellCheck={false}
            onChange={(e) => setBranch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
              if (e.key === 'Escape') setAdding(false)
            }}
            className="rounded border border-border bg-surface-0 px-2 py-0.5 text-fg outline-none focus:border-accent"
          />
          {trimmed && (
            <p className="text-[11px] text-fg-muted">
              {existing
                ? existing.worktreePath
                  ? 'Essa branch já está em uso em outra worktree.'
                  : `Usa a branch existente ${trimmed}.`
                : `Cria a branch ${trimmed} a partir do HEAD atual.`}
            </p>
          )}
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => void submit()}
            className="rounded-md bg-accent py-0.5 text-white enabled:hover:bg-accent/85 disabled:opacity-40"
          >
            Criar worktree
          </button>
        </div>
      )}

      <ul>
        {worktrees.map((w) => (
          <li
            key={w.path}
            title={w.path}
            className="group flex h-7 items-center gap-1.5 px-3 hover:bg-surface-2"
          >
            <span className="truncate">{basename(w.path)}</span>
            <span className="truncate text-[11px] text-fg-muted">{w.branch ?? w.head}</span>
            {w.isMain && (
              <span className="rounded bg-surface-3 px-1 text-[10px] text-fg-muted">principal</span>
            )}
            {w.isCurrent && (
              <span className="rounded bg-accent/30 px-1 text-[10px] text-fg">aberta</span>
            )}
            <span className="ml-auto flex gap-0.5">
              {!w.isCurrent && (
                <button
                  type="button"
                  aria-label={`Abrir worktree ${basename(w.path)}`}
                  title="Abrir como workspace"
                  onClick={() => void openWorktree(w.path)}
                  className="rounded p-0.5 text-fg-muted hover:bg-surface-3 hover:text-fg"
                >
                  <FolderOpen size={14} />
                </button>
              )}
              {!w.isMain && !w.isCurrent && (
                <button
                  type="button"
                  aria-label={`Remover worktree ${basename(w.path)}`}
                  title="Remover worktree"
                  onClick={() => void removeWorktree(w.path)}
                  className="rounded p-0.5 text-fg-muted hover:bg-surface-3 hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
