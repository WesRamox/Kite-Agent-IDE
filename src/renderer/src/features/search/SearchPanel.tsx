import { CaseSensitive, Ellipsis, RefreshCw, Regex, WholeWord, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useT } from '../../lib/i18n'
import { isMac } from '../../lib/platform'
import { useTaskSwitcherStore } from '../tasks/task-switcher.store'
import { SearchResults } from './SearchResults'
import { useSearchStore } from './search.store'
import { useTaskSearch } from './use-search'

// View "Buscar" (fora do canvas, ver docs/decisions.md): como a do VS Code, mas só nas worktrees
// da tarefa aberta.

const store = () => useSearchStore.getState()

const FIELD =
  'w-full rounded border border-border bg-surface-0 px-2 py-1 text-[13px] text-fg outline-none placeholder:text-fg-muted/60 focus:border-accent'

function Toggle({
  icon: Icon,
  label,
  pressed,
  onClick,
}: {
  icon: LucideIcon
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex size-[22px] items-center justify-center rounded ${
        pressed ? 'bg-accent/25 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      <Icon size={15} strokeWidth={1.8} />
    </button>
  )
}

export function SearchPanel() {
  const t = useT()
  const text = useSearchStore((x) => x.text)
  const caseSensitive = useSearchStore((x) => x.caseSensitive)
  const wholeWord = useSearchStore((x) => x.wholeWord)
  const regex = useSearchStore((x) => x.regex)
  const include = useSearchStore((x) => x.include)
  const exclude = useSearchStore((x) => x.exclude)
  const showFilters = useSearchStore((x) => x.showFilters)
  const focusSeq = useSearchStore((x) => x.focusSeq)
  const result = useTaskSearch()
  const input = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (focusSeq === 0) return
    input.current?.focus()
    input.current?.select()
  }, [focusSeq])

  if (!result.taskId) {
    return (
      <div className="flex flex-col gap-3 px-3.5 py-2 text-xs leading-normal text-fg-muted">
        <p>{t('search.noTask')}</p>
        <button
          type="button"
          onClick={() => useTaskSwitcherStore.getState().show()}
          className="h-[26px] self-start rounded-md border border-border bg-surface-2 px-2.5 text-xs text-fg hover:bg-surface-3"
        >
          {t('search.openTask')} ({isMac ? '⌘' : 'Ctrl+'}K)
        </button>
      </div>
    )
  }

  const searching = text.trim() !== '' && !result.data && !result.error
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 px-3 pb-2">
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <input
              ref={input}
              aria-label={t('search.input')}
              placeholder={t('search.placeholder')}
              value={text}
              spellCheck={false}
              onChange={(e) => store().set({ text: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && result.reload()}
              className={`${FIELD} pr-[74px]`}
            />
            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5">
              <Toggle
                icon={CaseSensitive}
                label={t('search.caseSensitive')}
                pressed={caseSensitive}
                onClick={() => store().toggle('caseSensitive')}
              />
              <Toggle
                icon={WholeWord}
                label={t('search.wholeWord')}
                pressed={wholeWord}
                onClick={() => store().toggle('wholeWord')}
              />
              <Toggle
                icon={Regex}
                label={t('search.regex')}
                pressed={regex}
                onClick={() => store().toggle('regex')}
              />
            </div>
          </div>
          <Toggle
            icon={Ellipsis}
            label={t('search.filters')}
            pressed={showFilters}
            onClick={() => store().set({ showFilters: !showFilters })}
          />
        </div>
        {showFilters && (
          <>
            <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
              {t('search.include')}
              <input
                value={include}
                placeholder={t('search.globsPlaceholder')}
                spellCheck={false}
                onChange={(e) => store().set({ include: e.target.value })}
                className={`font-geist-mono text-xs ${FIELD}`}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
              {t('search.exclude')}
              <input
                value={exclude}
                placeholder={t('search.globsPlaceholder')}
                spellCheck={false}
                onChange={(e) => store().set({ exclude: e.target.value })}
                className={`font-geist-mono text-xs ${FIELD}`}
              />
            </label>
          </>
        )}
        {text.trim() !== '' && (
          <div className="flex items-center gap-2 text-xs text-fg-muted" role="status">
            <span className="min-w-0 flex-1">
              {result.error ? (
                <span className="text-danger">{result.error}</span>
              ) : searching ? (
                t('search.searching')
              ) : result.data && result.data.matches === 0 ? (
                t('search.none')
              ) : result.data ? (
                t('search.summary', { matches: result.data.matches, files: result.data.files })
              ) : null}
            </span>
            <button
              type="button"
              title={t('search.refresh')}
              aria-label={t('search.refresh')}
              onClick={result.reload}
              className="rounded p-0.5 hover:bg-surface-2 hover:text-fg"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}
        {result.data?.truncated && (
          <p className="text-xs text-fg-muted">
            {t('search.truncated', { n: result.data.matches })}
          </p>
        )}
      </div>
      {result.data && !result.error && <SearchResults result={result.data} />}
    </div>
  )
}
