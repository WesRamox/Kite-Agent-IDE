import type { SearchFile, SearchResult } from '@shared/types'
import { ChevronRight } from 'lucide-react'
import { FileIcon } from '../../components/FileIcon'
import { useT } from '../../lib/i18n'
import { segments, splitRel } from './search'
import { openMatch } from './search.actions'
import { useSearchStore } from './search.store'

// Resultados por repo e por arquivo; clicar numa linha abre o arquivo nela.
export function SearchResults({ result }: { result: SearchResult }) {
  const t = useT()
  const collapsed = useSearchStore((s) => s.collapsed)
  const single = result.repos.length === 1
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 text-[13px]">
      {result.repos.map((repo) => (
        <div
          key={repo.worktree}
          role="group"
          aria-label={t('search.repo', { name: repo.repoName })}
        >
          {/* Com um repo só, o cabeçalho não diz nada além do que a tarefa já diz. */}
          {!single && (
            <div className="px-2 pt-2 pb-1 font-geist-mono text-[11px] font-medium text-fg-muted">
              {repo.repoName}
            </div>
          )}
          {repo.files.map((file) => (
            <FileResult key={file.path} file={file} collapsed={collapsed[file.path] === true} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FileResult({ file, collapsed }: { file: SearchFile; collapsed: boolean }) {
  const t = useT()
  const { name, dir } = splitRel(file.rel)
  return (
    <div className="flex flex-col">
      <button
        type="button"
        title={file.path}
        aria-expanded={!collapsed}
        aria-label={t('search.toggleFile', { file: file.rel })}
        onClick={() => useSearchStore.getState().toggleCollapsed(file.path)}
        className="flex h-[26px] items-center gap-1.5 rounded-[5px] pr-2 text-left text-fg/90 hover:bg-surface-2"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-fg-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
        />
        <FileIcon name={name} kind="file" open={false} />
        <span className="shrink-0">{name}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{dir}</span>
        <span className="rounded-full bg-surface-3 px-1.5 text-[11px] text-fg-muted">
          {file.matches.length}
        </span>
      </button>
      {!collapsed &&
        file.matches.map((m) => (
          <button
            key={`${m.line}:${m.column}`}
            type="button"
            aria-label={t('search.match', { file: file.rel, line: m.line })}
            onClick={() => void openMatch(file, m)}
            className="flex h-[22px] items-center gap-2 rounded-[5px] pr-2 pl-[38px] text-left hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1 truncate font-geist-mono text-xs text-fg/80">
              {segments(m.preview, m.ranges).map((seg, i) =>
                seg.hit ? (
                  <mark key={i} className="rounded-[2px] bg-accent/30 text-fg">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </span>
            <span className="shrink-0 text-[11px] text-fg-muted">{m.line}</span>
          </button>
        ))}
    </div>
  )
}
