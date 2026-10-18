import { Play } from 'lucide-react'
import { useState } from 'react'
import { isMac } from '../../lib/platform'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { branchSlug } from '../tasks/branch-slug'
import { createTaskWithAgent } from '../tasks/tasks.actions'
import { useTasksStore, NO_REPOS } from '../tasks/tasks.store'
import { useAgentsStore } from './agents.store'
import { useT } from '../../lib/i18n'

// "Nova tarefa" (Fase 10): nome → branch → repositórios → worktrees no padrão do workspace →
// agente na pasta da tarefa com o prompt inicial. Com um repo só, é o fluxo da Fase 5.

const FIELD =
  'rounded border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent'

const NO_AGENT = ''

export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const root = useWorkspaceStore((s) => s.root)
  const repos = useTasksStore((s) => s.workspace?.repos ?? NO_REPOS)
  const presets = useAgentsStore((s) => s.presets)
  const [name, setName] = useState('')
  const [branch, setBranch] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(() =>
    repos.length === 1 && repos[0] ? new Set([repos[0].path]) : new Set(),
  )
  const [presetId, setPresetId] = useState(() => presets[0]?.id ?? 'claude')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()

  const finalBranch = branch ?? branchSlug(name)
  const preset = presets.find((p) => p.id === presetId)
  const missingCommand = presetId !== NO_AGENT && !!preset && !preset.command.trim()
  const disabled =
    busy || !root || !name.trim() || !finalBranch || chosen.size === 0 || missingCommand

  const submit = async () => {
    if (disabled) return
    setBusy(true)
    const ok = await createTaskWithAgent({
      name: name.trim(),
      branch: finalBranch,
      repos: repos.filter((r) => chosen.has(r.path)).map((r) => r.path),
      presetId: presetId === NO_AGENT ? null : presetId,
      prompt,
    })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form
      aria-label={t('newTask.form')}
      className="flex flex-col gap-2 border-b border-border px-3.5 pt-2.5 pb-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('newTask.namePlaceholder')}
        aria-label={t('newTask.name')}
        className={FIELD}
      />
      <input
        value={finalBranch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder={t('newTask.branch')}
        aria-label={t('newTask.branch')}
        className={`font-geist-mono text-xs ${FIELD}`}
      />
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0" aria-label={t('newTask.repos')}>
        {repos.length === 0 && (
          <span className="text-[11px] text-fg-muted">{t('newTask.noRepos')}</span>
        )}
        {repos.map((r) => (
          <label key={r.path} className="flex items-center gap-2 text-xs" title={r.path}>
            <input
              type="checkbox"
              checked={chosen.has(r.path)}
              onChange={() =>
                setChosen((c) => {
                  const next = new Set(c)
                  if (next.has(r.path)) next.delete(r.path)
                  else next.add(r.path)
                  return next
                })
              }
              className="accent-accent"
            />
            <span className="font-geist-mono">{r.name}</span>
          </label>
        ))}
      </fieldset>
      <select
        value={presetId}
        onChange={(e) => setPresetId(e.target.value)}
        aria-label={t('newTask.agent')}
        className={FIELD}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.command.trim() ? ` — ${p.command}` : t('newTask.noCommand')}
          </option>
        ))}
        <option value={NO_AGENT}>{t('newTask.noAgent')}</option>
      </select>
      {presetId !== NO_AGENT && (
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (isMac ? e.metaKey : e.ctrlKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={4}
          placeholder={t('newTask.promptPlaceholder')}
          aria-label={t('newTask.prompt')}
          className={`resize-y ${FIELD}`}
        />
      )}
      <p className="text-[11px] leading-normal text-fg-muted">
        {!root
          ? t('newTask.openFolder')
          : missingCommand
            ? t('newTask.missingCommand')
            : chosen.size > 1 || (repos.length > 1 && chosen.size === 1)
              ? t('newTask.multiRepo', { branch: finalBranch || '…' })
              : t('newTask.singleRepo', { branch: finalBranch || '…' })}
      </p>
      <button
        type="submit"
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-md bg-accent py-1 text-accent-fg enabled:hover:bg-accent/85 disabled:opacity-40"
      >
        <Play size={14} />{' '}
        {busy
          ? t('newTask.creating')
          : presetId === NO_AGENT
            ? t('newTask.create')
            : t('newTask.start')}
      </button>
    </form>
  )
}
