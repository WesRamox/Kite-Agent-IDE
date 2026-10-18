import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../lib/i18n'
import { KiteLogo } from './KiteLogo'
import { copyText } from '../lib/clipboard'

// Um erro de renderização desmonta a árvore inteira do React e deixa a janela vazia. Aqui ele vira
// uma tela com o erro e "Recarregar"; o console.error chega ao log do main (logs/main.log).
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `Erro na interface: ${error.stack ?? error.message}\n${info.componentStack ?? ''}`,
    )
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const details = `${error.stack ?? error.message}`
    return (
      <div className="flex h-full items-center justify-center bg-surface-0 p-6 font-geist text-fg">
        <div role="alert" className="flex w-full max-w-xl flex-col gap-4">
          <KiteLogo size={30} />
          <h1 className="text-xl font-semibold">{t('crash.title')}</h1>
          <p className="leading-normal text-fg-muted">{t('crash.body')}</p>
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-surface-1 p-3 font-geist-mono text-xs whitespace-pre-wrap text-fg/80">
            {details}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-8 rounded-[7px] bg-accent px-3.5 font-semibold text-accent-fg hover:bg-accent/85"
            >
              {t('crash.reload')}
            </button>
            <button
              type="button"
              onClick={() => copyText(details)}
              className="h-8 rounded-[7px] border border-border bg-surface-2 px-3 hover:bg-surface-3"
            >
              {t('crash.copy')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
