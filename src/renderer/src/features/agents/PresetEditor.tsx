import type { AgentPreset } from '@shared/types'
import { useState } from 'react'
import { savePresets } from './agents.actions'
import { useAgentsStore } from './agents.store'

export function PresetEditor({ onDone }: { onDone: () => void }) {
  const saved = useAgentsStore((s) => s.presets)
  const [draft, setDraft] = useState<AgentPreset[]>(saved)

  const edit = (id: string, patch: Partial<AgentPreset>) =>
    setDraft((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  return (
    <form
      aria-label="Presets"
      className="flex flex-col gap-3 border-b border-border px-3 pb-3"
      onSubmit={(e) => {
        e.preventDefault()
        void savePresets(draft).then((ok) => ok && onDone())
      }}
    >
      {draft.map((p) => (
        <fieldset key={p.id} className="flex flex-col gap-1">
          <legend className="text-[11px] font-semibold text-fg">{p.name}</legend>
          <input
            value={p.command}
            onChange={(e) => edit(p.id, { command: e.target.value })}
            placeholder="Comando (ex.: claude --model opus)"
            aria-label={`Comando de ${p.name}`}
            spellCheck={false}
            className="rounded border border-border bg-surface-0 px-2 py-0.5 font-mono text-[12px] text-fg outline-none focus:border-accent"
          />
          <div className="flex gap-1">
            <select
              value={p.promptMode}
              onChange={(e) =>
                edit(p.id, { promptMode: e.target.value as AgentPreset['promptMode'] })
              }
              aria-label={`Modo do prompt de ${p.name}`}
              className="flex-1 rounded border border-border bg-surface-0 px-1 py-0.5 text-[11px] text-fg"
            >
              <option value="arg">Prompt como argumento</option>
              <option value="type">Digitar o prompt no terminal</option>
            </select>
            {p.promptMode === 'arg' && (
              <input
                value={p.promptFlag}
                onChange={(e) => edit(p.id, { promptFlag: e.target.value })}
                placeholder="flag (opcional)"
                aria-label={`Flag do prompt de ${p.name}`}
                className="w-24 rounded border border-border bg-surface-0 px-1 py-0.5 font-mono text-[11px] text-fg outline-none focus:border-accent"
              />
            )}
          </div>
        </fieldset>
      ))}
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-accent py-1 text-white hover:bg-accent/85"
        >
          Salvar presets
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-3 hover:bg-surface-2"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
