import type { KeyboardEvent, PointerEvent } from 'react'
import { useRef } from 'react'
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, useLayoutStore } from '../stores/layout.store'

const STEP = 16

// Borda direita da sidebar: arrastar ajusta a largura, duplo clique volta ao padrão e as setas
// do teclado ajustam de 16 em 16 px. A largura só é gravada ao soltar.
export function SidebarResizer() {
  const width = useLayoutStore((s) => s.sidebarWidth)
  const setWidth = useLayoutStore((s) => s.setSidebarWidth)
  const drag = useRef<{ x: number; width: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width }
    document.body.classList.add('kite-resizing')
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setWidth(drag.current.width + e.clientX - drag.current.x, false)
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    document.body.classList.remove('kite-resizing')
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    setWidth(useLayoutStore.getState().sidebarWidth)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0
    if (delta) {
      e.preventDefault()
      setWidth(width + delta)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setWidth(e.key === 'Home' ? SIDEBAR_MIN : SIDEBAR_MAX)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura da barra lateral"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      title="Arraste para ajustar · duplo clique volta ao padrão"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setWidth(SIDEBAR_DEFAULT)}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 -right-[3px] z-20 w-1.5 cursor-col-resize outline-none"
    >
      <div className="mx-auto h-full w-px bg-transparent transition-colors delay-150 group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent" />
    </div>
  )
}
