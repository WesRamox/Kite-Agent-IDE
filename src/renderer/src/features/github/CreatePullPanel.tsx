import { GitPullRequest } from 'lucide-react'
import { useState } from 'react'
import { useGitStore } from '../git/git.store'
import { createPull } from './github.actions'
import { useGitHubStore } from './github.store'

export function CreatePullPanel() {
  const status = useGitStore((s) => s.status)
  const branches = useGitStore((s) => s.branches)
  const repo = useGitHubStore((s) => s.repo)
  const head = status?.isRepo ? status.branch : null
  const [title, setTitle] = useState(() => (head ? head.replace(/[-_/]+/g, ' ') : ''))
  const [body, setBody] = useState('')
  const [base, setBase] = useState(repo?.defaultBranch ?? 'main')
  const [draft, setDraft] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!status?.isRepo)
    return <p className="p-6 text-fg-muted">Esta pasta não é um repositório Git.</p>
  if (!head)
    return (
      <p className="p-6 text-fg-muted">HEAD destacado: crie uma branch antes de abrir um PR.</p>
    )
  if (!repo)
    return <p className="p-6 text-fg-muted">Entre no GitHub (aba GitHub) para criar o PR.</p>

  const uncommitted = status.files.length > 0
  const sameAsBase = head === base
  const canSubmit = !busy && title.trim() !== '' && base.trim() !== '' && !sameAsBase

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    await createPull({ title: title.trim(), body, base: base.trim(), draft })
    setBusy(false)
  }

  return (
    <div className="h-full overflow-y-auto">
      <form
        className="mx-auto flex max-w-2xl flex-col gap-3 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h1 className="flex items-center gap-2 text-lg text-fg">
          <GitPullRequest size={18} /> Novo pull request
        </h1>
        <p className="text-fg-muted">
          De <code className="text-fg">{head}</code> para{' '}
          <code className="text-fg">
            {repo.owner}/{repo.repo}:{base}
          </code>
          . A branch será enviada (push) para o <code>origin</code>.
        </p>
        {uncommitted && (
          <p className="rounded-md border border-warning/50 px-3 py-2 text-warning">
            Há {status.files.length} alteração(ões) não commitadas; elas não entram no PR.
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">Descrição</span>
          <textarea
            value={body}
            rows={10}
            onChange={(e) => setBody(e.target.value)}
            className="resize-y rounded-md border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">Base</span>
          <input
            value={base}
            list="pr-base-branches"
            onChange={(e) => setBase(e.target.value)}
            className="rounded-md border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
          />
          <datalist id="pr-base-branches">
            {branches.map((b) => (
              <option key={b.name} value={b.name} />
            ))}
          </datalist>
          {sameAsBase && (
            <span className="text-[11px] text-danger">A base precisa ser outra branch.</span>
          )}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          Criar como rascunho
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="self-start rounded-md bg-accent px-4 py-1.5 text-white enabled:hover:bg-accent/85 disabled:opacity-40"
        >
          {busy ? 'Enviando…' : 'Criar pull request'}
        </button>
      </form>
    </div>
  )
}
