import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { fitMenu } from '../lib/menu-position'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  // Faixa acima dos itens (ex.: as cores de um bloco do quadro).
  header?: ReactNode
}

export function ContextMenu({ x, y, items, onClose, header }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', close, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Mantém o menu dentro da janela pelo tamanho medido: uma estimativa por item não contava a
  // faixa do topo (as cores de um bloco do quadro) e o fim do menu saía da tela.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { left, top } = fitMenu(
      { x, y },
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [x, y, items.length, header])

  // No body: dentro de um painel do dockview, `fixed` seria relativo ao painel (transform).
  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: x, top: y }}
      className="fixed z-50 max-h-[calc(100vh-16px)] min-w-48 overflow-y-auto rounded-md border border-border bg-surface-2 py-1 shadow-xl"
    >
      {header}
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            item.onSelect()
          }}
          className={`block w-full px-3 py-1 text-left hover:bg-accent/25 ${
            item.danger ? 'text-danger' : 'text-fg'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
