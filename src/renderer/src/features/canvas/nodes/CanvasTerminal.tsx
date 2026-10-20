import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef } from 'react'
import { t } from '../../../lib/i18n'
import { disposeSession, getOrCreateSession, getSession } from '../../terminal/terminal.actions'
import { canvasSessionId } from '../canvas'

// Terminal dentro do quadro. Com `agentId`, é uma visualização a mais do PTY do agente (ele segue
// rodando no main) e só impõe o tamanho quando recebe o foco. Com `cwd`, é um shell comum, que
// vive enquanto o bloco existir.
export function CanvasTerminal({
  nodeId,
  agentId,
  cwd,
}: {
  nodeId: string
  agentId?: string
  cwd?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || (!agentId && !cwd)) return
    const id = canvasSessionId(nodeId)
    const session = getOrCreateSession(id, {
      source: agentId ? { kind: 'agent', taskId: agentId } : { kind: 'shell', cwd: cwd ?? '' },
      mirror: Boolean(agentId),
      onExit: () => {
        if (!agentId) getSession(id)?.write(`\r\n\x1b[2m${t('canvas.terminalEnded')}\x1b[0m\r\n`)
      },
      onOpenSearch: () => {},
    })
    void session.attach(el)
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => session.fit(), 50)
    })
    observer.observe(el)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
      disposeSession(id)
    }
  }, [nodeId, agentId, cwd])

  return (
    <div className="nodrag nowheel nopan nokey h-full w-full bg-surface-0 py-1 pl-2">
      <div ref={ref} className="h-full w-full" />
    </div>
  )
}
