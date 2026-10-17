import { Play } from 'lucide-react'
import { useState } from 'react'
import { isMac } from '../../lib/platform'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { branchSlug } from '../tasks/branch-slug'
import { createTaskWithAgent } from '../tasks/tasks.actions'
import { useTasksStore } from '../tasks/tasks.store'
import { useAgentsStore } from './agents.store'

// "Nova tarefa" (Fase 10): nome → branch → repositórios → worktrees no padrão do workspace →
// agente na pasta da tarefa com o prompt inicial. Com um repo só, é o fluxo da Fase 5.

const FIELD =
  'rounded border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent'

const NO_AGENT = ''

export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const root = useWorkspaceStore((s) => s.root)
  const repos = useTasksStore((s) => s.workspace?.repos ?? [])
  const presets = useAgentsStore((s) => s.presets)
  const [name, setName] = useState('')
  const [branch, setBranch] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(() =>
    repos.length === 1 && repos[0] ? new Set([repos[0].path]) : new Set(),
  )
  const [presetId, setPresetId] = useState(() => presets[0]?.id ?? 'claude')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)

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
      aria-label="Nova tarefa"
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
        placeholder="Nome da tarefa (ex.: PAY-415 Estorno parcial)"
        aria-label="Nome da tarefa"
        className={FIELD}
      />
      <input
        value={finalBranch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="Branch"
        aria-label="Branch"
        className={`font-geist-mono text-xs ${FIELD}`}
      />
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0" aria-label="Repositórios">
        {repos.length === 0 && (
          <span className="text-[11px] text-fg-muted">Nenhum repositório nesta pasta.</span>
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
        aria-label="Agente"
        className={FIELD}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.command.trim() ? ` — ${p.command}` : ' (sem comando)'}
          </option>
        ))}
        <option value={NO_AGENT}>Nenhum (só criar a tarefa)</option>
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
          placeholder="Prompt inicial (opcional)"
          aria-label="Prompt inicial"
          className={`resize-y ${FIELD}`}
        />
      )}
      <p className="text-[11px] leading-normal text-fg-muted">
        {!root
          ? 'Abra uma pasta para criar tarefas.'
          : missingCommand
            ? 'Defina o comando deste preset em Conectar agentes → Outros CLIs → Ajustar.'
            : chosen.size > 1 || (repos.length > 1 && chosen.size === 1)
              ? `Cria uma worktree por repo na branch ${finalBranch || '…'}, na pasta da tarefa.`
              : `Cria a branch ${finalBranch || '…'} e uma worktree a partir do HEAD do repositório.`}
      </p>
      <button
        type="submit"
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-md bg-accent py-1 text-accent-fg enabled:hover:bg-accent/85 disabled:opacity-40"
      >
        <Play size={14} />{' '}
        {busy ? 'Criando worktrees…' : presetId === NO_AGENT ? 'Criar tarefa' : 'Iniciar agente'}
      </button>
    </form>
  )
}
