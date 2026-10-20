import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { fuzzyFilter } from '../../lib/fuzzy'
import { basename } from '../../lib/paths'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useActiveTask } from '../tasks/tasks.store'
import { openFile } from '../editor/editor.actions'
import { FileIcon } from '../../components/FileIcon'
import { useQuickOpenStore, type QuickOpenRoot } from './quick-open.store'
import { useT } from '../../lib/i18n'

function Highlighted({ text, positions }: { text: string; positions: Set<number> }) {
  return (
    <>
      {[...text].map((ch, i) =>
        positions.has(i) ? (
          <span key={i} className="font-semibold text-accent">
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </>
  )
}

export function QuickOpen() {
  const open = useQuickOpenStore((s) => s.open)
  const root = useWorkspaceStore((s) => s.root)
  const task = useActiveTask()
  if (!open || !root) return null
  const roots: QuickOpenRoot[] = task
    ? task.worktrees.map((w) => ({ path: w.path, label: w.repoName }))
    : [{ path: root, label: null }]
  return <QuickOpenDialog roots={roots} />
}

function QuickOpenDialog({ roots }: { roots: QuickOpenRoot[] }) {
  const t = useT()
  const files = useQuickOpenStore((s) => s.files)
  const loading = useQuickOpenStore((s) => s.loading)
  const hide = useQuickOpenStore((s) => s.hide)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  // Lista as raízes de novo quando a lista é invalidada (files volta a null), não a cada render
  // (roots é um array novo a cada vez).
  const ensureFiles = useEffectEvent(() => void useQuickOpenStore.getState().ensureFiles(roots))
  useEffect(() => ensureFiles(), [files])

  const items = useMemo(() => fuzzyFilter(query, files ?? [], (f) => f.rel, 50), [files, query])

  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  // Abre no editor ou entrega a quem pediu o arquivo (showPicker).
  const deliver = (path: string) => {
    const pick = useQuickOpenStore.getState().pick
    hide()
    if (pick) pick(path)
    else void openFile(path)
  }

  const choose = (index: number) => {
    const item = items[index]
    if (!item) return
    deliver(item.item.path)
  }

  // Enter antes da lista carregar: espera a lista e abre o melhor resultado.
  const chooseWhenLoaded = async () => {
    const store = useQuickOpenStore.getState()
    await store.ensureFiles(roots)
    const loaded = useQuickOpenStore.getState().files ?? []
    const first = fuzzyFilter(query, loaded, (f) => f.rel, 1)[0]
    if (!first || !useQuickOpenStore.getState().open) return
    deliver(first.item.path)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center bg-black/30 pt-[12vh]"
      onMouseDown={hide}
    >
      <div
        role="dialog"
        aria-label={t('quickOpen.label')}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-fit max-h-[60vh] w-[600px] flex-col overflow-hidden rounded-lg border border-border bg-surface-2 shadow-2xl"
      >
        <input
          autoFocus
          value={query}
          placeholder={t('quickOpen.placeholder')}
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') hide()
            else if (e.key === 'Enter') {
              if (files === null) void chooseWhenLoaded()
              else choose(selected)
            } else if (e.key === 'ArrowDown') setSelected((s) => Math.min(s + 1, items.length - 1))
            else if (e.key === 'ArrowUp') setSelected((s) => Math.max(s - 1, 0))
            else return
            e.preventDefault()
          }}
          className="border-b border-border bg-transparent px-3 py-2 text-fg outline-none"
        />
        <ul ref={listRef} className="overflow-y-auto py-1">
          {loading && files === null && (
            <li className="px-3 py-1 text-fg-muted">{t('common.loading')}</li>
          )}
          {!loading && items.length === 0 && (
            <li className="px-3 py-1 text-fg-muted">{t('quickOpen.none')}</li>
          )}
          {items.map(({ item, match }, i) => {
            const name = basename(item.path)
            const nameStart = item.rel.length - name.length
            const positions = new Set(match.positions)
            const namePos = new Set(
              [...positions].filter((p) => p >= nameStart).map((p) => p - nameStart),
            )
            const dirPos = new Set([...positions].filter((p) => p < nameStart))
            return (
              <li
                key={item.path}
                onMouseMove={() => setSelected(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1 ${
                  i === selected ? 'bg-accent/25' : ''
                }`}
              >
                <FileIcon name={name} kind="file" />
                <span className="text-fg">
                  <Highlighted text={name} positions={namePos} />
                </span>
                <span className="truncate text-[11px] text-fg-muted">
                  <Highlighted text={item.rel.slice(0, nameStart)} positions={dirPos} />
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
