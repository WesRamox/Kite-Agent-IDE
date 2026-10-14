import { useEffect, useMemo, useRef, useState } from 'react'
import { fuzzyFilter } from '../../lib/fuzzy'
import { basename, relative } from '../../lib/paths'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { openFile } from '../editor/editor.actions'
import { FileIcon } from '../explorer/FileIcon'
import { useQuickOpenStore } from './quick-open.store'

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
  if (!open || !root) return null
  return <QuickOpenDialog root={root} />
}

function QuickOpenDialog({ root }: { root: string }) {
  const files = useQuickOpenStore((s) => s.files)
  const loading = useQuickOpenStore((s) => s.loading)
  const hide = useQuickOpenStore((s) => s.hide)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    void useQuickOpenStore.getState().ensureFiles(root)
  }, [root, files])

  const items = useMemo(() => {
    const rel = (files ?? []).map((path) => ({ path, rel: relative(root, path) }))
    return fuzzyFilter(query, rel, (f) => f.rel, 50)
  }, [files, query, root])

  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const choose = (index: number) => {
    const item = items[index]
    if (!item) return
    hide()
    void openFile(item.item.path)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center bg-black/30 pt-[12vh]"
      onMouseDown={hide}
    >
      <div
        role="dialog"
        aria-label="Abrir arquivo"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-fit max-h-[60vh] w-[600px] flex-col overflow-hidden rounded-lg border border-border bg-surface-2 shadow-2xl"
      >
        <input
          autoFocus
          value={query}
          placeholder="Buscar arquivo pelo nome"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') hide()
            else if (e.key === 'Enter') choose(selected)
            else if (e.key === 'ArrowDown') setSelected((s) => Math.min(s + 1, items.length - 1))
            else if (e.key === 'ArrowUp') setSelected((s) => Math.max(s - 1, 0))
            else return
            e.preventDefault()
          }}
          className="border-b border-border bg-transparent px-3 py-2 text-fg outline-none"
        />
        <ul ref={listRef} className="overflow-y-auto py-1">
          {loading && files === null && <li className="px-3 py-1 text-fg-muted">Carregando…</li>}
          {!loading && items.length === 0 && (
            <li className="px-3 py-1 text-fg-muted">Nenhum arquivo encontrado.</li>
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
