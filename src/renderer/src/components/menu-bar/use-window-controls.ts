import { useEffect, useState } from 'react'

// Estado e ações da janela para os botões da barra de menus (a janela não tem moldura).
export function useWindowControls() {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    void window.api.window.isMaximized().then((res) => res.ok && setMaximized(res.data))
    return window.api.window.onMaximized(setMaximized)
  }, [])
  return {
    maximized,
    minimize: () => void window.api.window.minimize(),
    toggleMaximize: () => void window.api.window.toggleMaximize(),
    close: () => void window.api.window.close(),
  }
}
