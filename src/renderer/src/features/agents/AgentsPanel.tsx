import { Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useAgentsStore } from './agents.store'
import { NewTaskForm } from './NewTaskForm'
import { PresetEditor } from './PresetEditor'
import { TaskCard } from './TaskCard'

export function AgentsPanel() {
  const tasks = useAgentsStore((s) => s.tasks)
  const [mode, setMode] = useState<'list' | 'new' | 'presets'>('list')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1 px-3 pb-2">
        <button
          type="button"
          aria-pressed={mode === 'new'}
          onClick={() => setMode(mode === 'new' ? 'list' : 'new')}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-1 text-white hover:bg-accent/85"
        >
          <Plus size={14} /> Nova tarefa
        </button>
        <button
          type="button"
          title="Presets dos agentes"
          aria-label="Presets dos agentes"
          aria-pressed={mode === 'presets'}
          onClick={() => setMode(mode === 'presets' ? 'list' : 'presets')}
          className="rounded-md border border-border px-2 text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Settings2 size={14} />
        </button>
      </div>
      {mode === 'new' && <NewTaskForm onDone={() => setMode('list')} />}
      {mode === 'presets' && <PresetEditor onDone={() => setMode('list')} />}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-fg-muted">
            Nenhuma tarefa ainda. Cada tarefa roda um agente numa worktree própria.
          </p>
        ) : (
          <ul aria-label="Tarefas">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
