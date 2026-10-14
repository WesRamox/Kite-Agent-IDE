import { useAppInfo } from '../lib/use-app-info'

export function StatusBar() {
  const info = useAppInfo()

  return (
    <footer className="flex h-6 items-center gap-4 border-t border-border bg-surface-1 px-3 text-[11px] text-fg-muted">
      <span>sem branch</span>
      <span>sem worktree</span>
      <span>0 agentes</span>
      <span className="ml-auto">{info ? `v${info.version} · ${info.platform}` : ''}</span>
    </footer>
  )
}
