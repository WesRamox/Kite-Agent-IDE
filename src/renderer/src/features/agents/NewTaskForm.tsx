import { Play } from 'lucide-react'
import { useState } from 'react'
import { isMac } from '../../lib/platform'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useGitStore } from '../git/git.store'
import { startAgent } from './agents.actions'
import { useAgentsStore } from './agents.store'

export function NewTaskForm({ onDone }: { onDone: () => void }) {
  const root = useWorkspaceStore((s) => s.root)
  const status = useGitStore((s) => s.status)
  const presets = useAgentsStore((s) => s.presets)
  const [name, setName] = useState('')
  const [presetId, setPresetId] = useState(() => presets[0]?.id ?? 'claude')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)

  const preset = presets.find((p) => p.id === presetId)
  const base = status?.isRepo ? (status.branch ?? status.head) : null
  const missingCommand = !!preset && !preset.command.trim()
  const disabled = busy || !root || !base || !name.trim() || missingCommand

  const submit = async () => {
    if (disabled || !root) return
    setBusy(true)
    const ok = await startAgent({ root, name: name.trim(), presetId, prompt })
    setBusy(false)
    if (ok) {
      setName('')
      setPrompt('')
      onDone()
    }
  }

  return (
    <form
      aria-label="Nova tarefa"
      className="flex flex-col gap-2 border-b border-border px-3 pb-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da tarefa"
        aria-label="Nome da tarefa"
        className="rounded border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
      />
      <select
        value={presetId}
        onChange={(e) => setPresetId(e.target.value)}
        aria-label="Agente"
        className="rounded border border-border bg-surface-0 px-2 py-1 text-fg"
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.command.trim() ? ` — ${p.command}` : ' (sem comando)'}
          </option>
        ))}
      </select>
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
        className="resize-y rounded border border-border bg-surface-0 px-2 py-1 text-fg outline-none focus:border-accent"
      />
      <p className="text-[11px] text-fg-muted">
        {!root
          ? 'Abra uma pasta para criar tarefas.'
          : !base
            ? 'A pasta precisa ser um repositório Git com pelo menos um commit.'
            : missingCommand
              ? 'Defina o comando deste preset em "Presets".'
              : `Cria a branch agent/… e uma worktree a partir de ${base}.`}
      </p>
      <button
        type="submit"
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-md bg-accent py-1 text-accent-fg enabled:hover:bg-accent/85 disabled:opacity-40"
      >
        <Play size={14} /> {busy ? 'Criando worktree…' : 'Iniciar agente'}
      </button>
    </form>
  )
}
