import { Copy, Minus, Square, X } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useWindowControls } from './use-window-controls'

const BTN =
  'flex h-full w-[46px] items-center justify-center text-fg-muted [-webkit-app-region:no-drag] hover:bg-surface-3 hover:text-fg'

// Minimizar, maximizar e fechar no canto da barra de menus (a janela não tem a barra de título
// do sistema). No macOS ficam os botões nativos, à esquerda.
export function WindowControls() {
  const t = useT()
  const { maximized, minimize, toggleMaximize, close } = useWindowControls()

  return (
    <div className="ml-auto flex h-full">
      <button type="button" aria-label={t('window.minimize')} onClick={minimize} className={BTN}>
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label={maximized ? t('window.restore') : t('window.maximize')}
        onClick={toggleMaximize}
        className={BTN}
      >
        {maximized ? <Copy size={12} className="-scale-x-100" /> : <Square size={12} />}
      </button>
      <button
        type="button"
        aria-label={t('window.close')}
        onClick={close}
        className={`${BTN} hover:bg-danger hover:text-white`}
      >
        <X size={15} />
      </button>
    </div>
  )
}
