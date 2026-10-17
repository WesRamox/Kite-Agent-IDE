import type { KeyboardEvent, PointerEvent } from 'react'
import { useEffect, useRef } from 'react'
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, useLayoutStore } from '../stores/layout.store'
import { useT } from '../lib/i18n'

const STEP = 16
const DOUBLE_CLICK_MS = 400

// Borda direita da sidebar: arrastar ajusta a largura, duplo clique volta ao padrão e as setas
// do teclado ajustam de 16 em 16 px. A largura só é gravada ao soltar.
//
// O arrasto segue os eventos da janela, não a captura do ponteiro: o Chromium às vezes perde a
// captura sem mandar pointerup, e o arrasto ficaria preso (com a página inteira sem cliques).
export function SidebarResizer() {
  const width = useLayoutStore((s) => s.sidebarWidth)
  const setWidth = useLayoutStore((s) => s.setSidebarWidth)
  const stop = useRef<(() => void) | null>(null)
  const t = useT()
  // Duplo clique detectado aqui: o dblclick do navegador chega com o alvo errado porque o arrasto
  // desliga os cliques da página entre um clique e outro.
  const lastDown = useRef({ time: 0, x: 0 })

  useEffect(() => () => stop.current?.(), [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    stop.current?.()
    const prev = lastDown.current
    lastDown.current = { time: e.timeStamp, x: e.clientX }
    if (e.timeStamp - prev.time < DOUBLE_CLICK_MS && Math.abs(e.clientX - prev.x) < 4) {
      lastDown.current = { time: 0, x: 0 }
      setWidth(SIDEBAR_DEFAULT)
      return
    }
    const start = { x: e.clientX, width }
    const move = (ev: globalThis.PointerEvent) =>
      setWidth(start.width + ev.clientX - start.x, false)
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      document.body.classList.remove('kite-resizing')
      stop.current = null
      setWidth(useLayoutStore.getState().sidebarWidth)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    document.body.classList.add('kite-resizing')
    stop.current = end
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
      aria-label={t('sidebar.resize')}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      title={t('sidebar.resizeHint')}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group absolute inset-y-0 -right-[3px] z-20 w-1.5 cursor-col-resize outline-none"
    >
      <div className="mx-auto h-full w-px bg-transparent transition-colors delay-150 group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent" />
    </div>
  )
}
