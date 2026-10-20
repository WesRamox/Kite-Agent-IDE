import { BROWSER_PARTITION } from '@shared/browser'
import { isWebUrl, toBrowserUrl } from '@shared/web-url'
import type { NodeProps } from '@xyflow/react'
import { Globe, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { copyText } from '../../../lib/clipboard'
import { useT } from '../../../lib/i18n'
import type { FlowNodeOf } from '../canvas'
import { patchNode } from '../canvas.actions'
import { webviews, type WebviewHandle } from '../canvas.registry'
import { NodeFrame } from './NodeFrame'

type NavigateEvent = Event & { url: string }

// Navegador do quadro: abre sites e telas locais (o main barra o que não é http/https), numa
// sessão própria. O que não é endereço vira pesquisa.
export function BrowserNode({ id, data, selected }: NodeProps<FlowNodeOf<'browser'>>) {
  const ref = useRef<WebviewHandle>(null)
  // O src só vale na criação: depois a navegação é pelo loadURL, para não recarregar à toa.
  const [src] = useState(data.url)
  const [draft, setDraft] = useState(data.url)
  const [invalid, setInvalid] = useState(false)
  const t = useT()

  useEffect(() => {
    const view = ref.current
    if (!view) return
    const onNavigate = (event: Event) => {
      const url = (event as NavigateEvent).url
      setDraft(url)
      setInvalid(false)
      if (isWebUrl(url)) patchNode(id, (d) => (d.kind === 'browser' ? { ...d, url } : d))
    }
    view.addEventListener('did-navigate', onNavigate)
    view.addEventListener('did-navigate-in-page', onNavigate)
    // Os agentes ligados a este bloco navegam e leem a página por aqui.
    webviews.set(id, view)
    return () => {
      webviews.delete(id)
      view.removeEventListener('did-navigate', onNavigate)
      view.removeEventListener('did-navigate-in-page', onNavigate)
    }
  }, [id])

  const go = () => {
    const url = toBrowserUrl(draft)
    setInvalid(url === null)
    if (url) void ref.current?.loadURL(url)
  }

  return (
    <NodeFrame
      id={id}
      data={data}
      selected={selected}
      icon={Globe}
      title={t('canvas.browser')}
      menu={[
        { label: t('canvas.reload'), onSelect: () => ref.current?.reload() },
        // O main abre http(s) no navegador do sistema (setWindowOpenHandler).
        { label: t('canvas.menu.openExternal'), onSelect: () => window.open(data.url, '_blank') },
        { label: t('canvas.menu.copyUrl'), onSelect: () => copyText(data.url) },
      ]}
      actions={
        <>
          <input
            aria-label={t('canvas.address')}
            placeholder={t('canvas.addressPlaceholder')}
            title={invalid ? t('canvas.invalidAddress') : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            className={`nodrag h-6 w-[min(320px,45%)] rounded-md border bg-surface-0 px-2 font-geist-mono text-[11px] text-fg outline-none focus:border-accent ${
              invalid ? 'border-danger' : 'border-border'
            }`}
          />
          <button
            type="button"
            aria-label={t('canvas.reload')}
            title={t('canvas.reload')}
            onClick={() => ref.current?.reload()}
            className="nodrag flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <RotateCw size={12} />
          </button>
        </>
      }
    >
      <webview
        ref={ref}
        src={src}
        partition={BROWSER_PARTITION}
        className="nodrag nowheel nopan flex h-full w-full bg-white"
      />
    </NodeFrame>
  )
}
