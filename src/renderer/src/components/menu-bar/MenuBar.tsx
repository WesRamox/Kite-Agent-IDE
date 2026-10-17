import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useActiveTask } from '../../features/tasks/tasks.store'
import { basename } from '../../lib/paths'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { buildMenus, type MenuDef, type MenuEntry } from './menus'

// Barra de menus no topo da janela, no lugar do menu nativo (removido no Linux/Windows). Como no
// VS Code: clique abre, passar o mouse troca de menu enquanto um está aberto, setas navegam.
// Os botões não tiram o foco do editor/terminal (mousedown com preventDefault).

type Selectable = Exclude<MenuEntry, { kind: 'sep' }>

const enabled = (items: MenuEntry[]) =>
  items.filter((e): e is Selectable => e.kind !== 'sep' && !e.disabled)

function Dropdown({
  items,
  active,
  sub,
  onHover,
  onRun,
  className,
}: {
  items: MenuEntry[]
  active: number
  // Submenu aberto (índice entre os habilitados) e o item ativo dentro dele.
  sub: { index: number; active: number } | null
  onHover: (index: number) => void
  onRun: (entry: Selectable) => void
  className: string
}) {
  const list = enabled(items)
  return (
    <div
      role="menu"
      className={`absolute z-50 min-w-56 rounded-md border border-border bg-surface-2 py-1 shadow-xl ${className}`}
    >
      {items.map((entry, i) => {
        if (entry.kind === 'sep') return <div key={`sep-${i}`} className="my-1 h-px bg-border" />
        const index = list.indexOf(entry as Selectable)
        const isActive = index >= 0 && index === active
        const label = entry.label
        return (
          <div key={label} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup={entry.kind === 'sub' ? 'menu' : undefined}
              aria-checked={
                entry.kind === 'item' && entry.checked !== undefined ? entry.checked : undefined
              }
              disabled={entry.disabled}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => index >= 0 && onHover(index)}
              onClick={() => entry.kind === 'item' && onRun(entry)}
              className={`flex h-7 w-full items-center gap-2 px-2 text-left text-[13px] disabled:opacity-40 ${
                isActive ? 'bg-accent/25 text-fg' : 'text-fg'
              }`}
            >
              <span className="flex w-4 shrink-0 justify-center">
                {entry.kind === 'item' && entry.checked && <Check size={13} />}
              </span>
              <span className="flex-1 truncate">{label}</span>
              {entry.kind === 'item' && entry.shortcut && (
                <span className="ml-6 font-geist-mono text-[11px] text-fg-muted">
                  {entry.shortcut}
                </span>
              )}
              {entry.kind === 'sub' && <ChevronRight size={13} className="ml-6 text-fg-muted" />}
            </button>
            {entry.kind === 'sub' && sub && sub.index === index && entry.items.length > 0 && (
              <Dropdown
                items={entry.items}
                active={sub.active}
                sub={null}
                onHover={() => {}}
                onRun={onRun}
                className="top-0 left-full -mt-1 ml-0.5"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MenuBar() {
  const [menus, setMenus] = useState<MenuDef[]>(() => buildMenus())
  const [open, setOpen] = useState<number | null>(null)
  const [active, setActive] = useState(-1)
  const [sub, setSub] = useState<{ index: number; active: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const root = useWorkspaceStore((s) => s.root)
  const task = useActiveTask()

  const show = (index: number | null) => {
    if (index !== null) setMenus(buildMenus())
    setOpen(index)
    setActive(-1)
    setSub(null)
  }
  const close = () => show(null)

  const run = (entry: Selectable) => {
    if (entry.kind !== 'item' || entry.disabled) return
    close()
    entry.run()
  }

  // Hover num item: destaca e, se for submenu, abre ele.
  const hover = (index: number) => {
    setActive(index)
    const entry = open === null ? undefined : enabled(menus[open]?.items ?? [])[index]
    setSub(entry?.kind === 'sub' ? { index, active: -1 } : null)
  }

  useEffect(() => {
    if (open === null) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      const items = enabled(menus[open]?.items ?? [])
      const subItems =
        sub && items[sub.index]?.kind === 'sub'
          ? enabled((items[sub.index] as Extract<MenuEntry, { kind: 'sub' }>).items)
          : null
      let handled = true
      if (e.key === 'Escape') {
        if (sub && sub.active >= 0) setSub(null)
        else close()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const step = e.key === 'ArrowDown' ? 1 : -1
        if (subItems && sub && sub.active >= 0) {
          setSub({ ...sub, active: (sub.active + step + subItems.length) % subItems.length })
        } else if (items.length > 0) {
          setActive((a) =>
            a < 0 && step < 0 ? items.length - 1 : (a + step + items.length) % items.length,
          )
          setSub(null)
        }
      } else if (e.key === 'ArrowRight') {
        const entry = items[active]
        if (entry?.kind === 'sub' && (!sub || sub.active < 0) && !entry.disabled) {
          setSub({ index: active, active: 0 })
        } else show((open + 1) % menus.length)
      } else if (e.key === 'ArrowLeft') {
        if (sub && sub.active >= 0) setSub({ ...sub, active: -1 })
        else show((open - 1 + menus.length) % menus.length)
      } else if (e.key === 'Enter' || e.key === ' ') {
        const target = subItems && sub && sub.active >= 0 ? subItems[sub.active] : items[active]
        if (target?.kind === 'sub') setSub({ index: active, active: 0 })
        else if (target) run(target)
      } else handled = false
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', close)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, sub, menus])

  const title = [root ? basename(root) : null, task?.name].filter(Boolean).join(' — ')

  return (
    <div
      ref={ref}
      role="menubar"
      aria-label="Menu do Kite"
      className="relative flex h-[30px] shrink-0 items-center border-b border-border bg-surface-1 px-1.5 font-geist text-[13px]"
    >
      {menus.map((m, i) => (
        <div key={m.id} className="relative">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => show(open === i ? null : i)}
            onMouseEnter={() => open !== null && open !== i && show(i)}
            className={`h-[22px] rounded px-2 ${
              open === i ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            {m.label}
          </button>
          {open === i && (
            <Dropdown
              items={m.items}
              active={active}
              sub={sub}
              onHover={hover}
              onRun={run}
              className="top-full left-0 mt-1"
            />
          )}
        </div>
      ))}
      {title && (
        <span className="pointer-events-none absolute left-1/2 max-w-[40%] -translate-x-1/2 truncate text-xs text-fg-muted">
          {title}
        </span>
      )}
    </div>
  )
}
