import { useEditorStore } from '../features/editor/editor.store'
import { useAppInfo } from '../lib/use-app-info'

export function StatusBar() {
  const info = useAppInfo()
  const cursor = useEditorStore((s) => s.cursor)
  const language = useEditorStore((s) => (s.activePath ? s.tabs[s.activePath]?.language : null))

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-surface-1 px-3 text-[11px] text-fg-muted">
      <span>sem branch</span>
      <span>sem worktree</span>
      <span>0 agentes</span>
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
