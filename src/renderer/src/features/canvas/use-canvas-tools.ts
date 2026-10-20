import { useEffect } from 'react'
import { t } from '../../lib/i18n'
import { runCanvasTool } from './canvas-tools'

// Atende os pedidos dos agentes às ferramentas do quadro (chegam do main, que fala com o MCP).
export function useCanvasTools(): void {
  useEffect(
    () =>
      window.api.canvas.onToolCall((call) => {
        void runCanvasTool(call)
          .catch((err: unknown) => ({
            ok: false as const,
            message: t('canvas.tool.failed', {
              reason: err instanceof Error ? err.message : String(err),
            }),
          }))
          .then((result) => window.api.canvas.toolReply(call.requestId, result))
      }),
    [],
  )
}
