import { FolderOpen, X } from 'lucide-react'
import { KiteLogo } from '../components/KiteLogo'
import { basename } from '../lib/paths'
import { isMac } from '../lib/platform'
import { useWorkspaceStore } from '../stores/workspace.store'
import { openFolder, openRecent } from './workspace.actions'

const mod = isMac ? '⌘' : 'Ctrl+'

export function Welcome() {
  const root = useWorkspaceStore((s) => s.root)
  const recent = useWorkspaceStore((s) => s.recent)
  const removeRecent = useWorkspaceStore((s) => s.removeRecent)

  if (root) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-2">
          <dt>Abrir arquivo</dt>
          <dd className="font-mono text-fg">{mod}P</dd>
          <dt>Salvar</dt>
          <dd className="font-mono text-fg">{mod}S</dd>
          <dt>Fechar aba</dt>
          <dd className="font-mono text-fg">{mod}W</dd>
        </dl>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-96">
        <div className="flex items-center gap-3">
          <KiteLogo size={34} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Kite</h1>
            <p className="text-fg-muted">IDE para trabalhar com agentes de IA.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void openFolder()}
          className="mt-6 flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:bg-accent/85"
        >
          <FolderOpen size={14} /> Abrir pasta
        </button>
        {recent.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
              Recentes
            </h2>
            <ul>
              {recent.map((p) => (
                <li key={p} className="group flex items-center gap-2">
                  <button
                    type="button"
                    title={p}
                    onClick={() => void openRecent(p)}
                    className="flex min-w-0 flex-1 items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-2"
                  >
                    <span className="text-accent">{basename(p)}</span>
                    <span className="truncate text-[11px] text-fg-muted">{p}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Remover das recentes"
                    onClick={() => void removeRecent(p)}
                    className="invisible rounded p-0.5 text-fg-muted group-hover:visible hover:text-fg"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
