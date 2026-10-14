import { SquareTerminal } from 'lucide-react'
import { useEditorStore } from '../features/editor/editor.store'
import { focusOrCreateTerminal } from '../features/terminal/terminal.actions'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useAppInfo } from '../lib/use-app-info'

export function StatusBar() {
  const info = useAppInfo()
  const root = useWorkspaceStore((s) => s.root)
  const cursor = useEditorStore((s) => s.cursor)
  const language = useEditorStore((s) => (s.activePath ? s.tabs[s.activePath]?.language : null))

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-surface-1 px-3 text-[11px] text-fg-muted">
      <span>sem branch</span>
      <span>sem worktree</span>
      <span>0 agentes</span>
      {root && (
        <button
          type="button"
          title="Terminal (Ctrl+`)"
          onClick={focusOrCreateTerminal}
          className="flex items-center gap-1 hover:text-fg"
        >
          <SquareTerminal size={12} /> Terminal
        </button>
      )}
      <span className="ml-auto flex gap-4">
        {cursor && (
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
        )}
        {language && <span>{language}</span>}
        {info && <span>v{info.version}</span>}
      </span>
    </footer>
  )
}
