import type { CanvasToolCall, CanvasToolContent, CanvasToolResult } from '@shared/types'
import { toBrowserUrl } from '@shared/web-url'
import { t } from '../../lib/i18n'
import { useAgentsStore } from '../agents/agents.store'
import { useTasksStore } from '../tasks/tasks.store'
import { getSession } from '../terminal/terminal.actions'
import { canvasSessionId, findCaller, linkedTo, type FlowNode } from './canvas'
import { patchNode } from './canvas.actions'
import { codeHandles, webviews } from './canvas.registry'
import { useCanvasStore } from './canvas.store'

// Executa as ferramentas do quadro que um agente pediu (pelo servidor MCP do Kite). O agente só
// alcança os blocos ligados ao bloco dele no workflow aberto.

const MAX_TEXT = 30_000
const ok = (...content: CanvasToolContent[]): CanvasToolResult => ({ ok: true, content })
const text = (value: string): CanvasToolResult =>
  ok({ type: 'text', text: value.slice(0, MAX_TEXT) })
const fail = (message: string): CanvasToolResult => ({ ok: false, message })

function name(node: FlowNode): string {
  const d = node.data
  if (d.label) return d.label
  if (d.kind === 'agent')
    return useAgentsStore.getState().tasks.find((a) => a.id === d.agentId)?.name ?? d.agentId
  if (d.kind === 'summary')
    return (
      useTasksStore.getState().workspace?.tasks.find((x) => x.id === d.taskId)?.name ?? d.taskId
    )
  if (d.kind === 'code' && d.path) return d.path
  return t(`canvas.kind.${d.kind}`)
}

function describe(node: FlowNode): string {
  const d = node.data
  const extra =
    d.kind === 'browser'
      ? (webviews.get(node.id)?.getURL() ?? d.url)
      : d.kind === 'terminal'
        ? d.cwd
        : d.kind === 'note'
          ? `${d.text.length} caracteres`
          : ''
  return `- ${node.id} · ${t(`canvas.kind.${d.kind}`)} · ${name(node)}${extra ? ` · ${extra}` : ''}`
}

export async function runCanvasTool(call: CanvasToolCall): Promise<CanvasToolResult> {
  const { root, nodes, edges } = useCanvasStore.getState()
  if (!root) return fail(t('canvas.tool.noCanvas'))
  const self = findCaller(call.caller, nodes)
  if (!self) return fail(t('canvas.tool.notOnCanvas'))
  const linked = linkedTo(self.id, nodes, edges)
  if (call.tool === 'list') {
    return text(linked.length ? linked.map(describe).join('\n') : t('canvas.tool.nothingLinked'))
  }
  const node = linked.find((n) => n.id === call.args.block)
  if (!node) return fail(t('canvas.tool.notLinked'))
  const d = node.data
  const session = getSession(canvasSessionId(node.id))
  const view = webviews.get(node.id)

  switch (call.tool) {
    case 'read': {
      if (d.kind === 'note') return text(d.text || t('canvas.tool.empty'))
      if (d.kind === 'summary') {
        const task = useTasksStore.getState().workspace?.tasks.find((x) => x.id === d.taskId)
        return text(task?.summary.join('\n') || t('details.summaryEmpty'))
      }
      if (d.kind === 'code') {
        const code = codeHandles.get(node.id)?.text() ?? d.text ?? ''
        return text(d.path ? `${d.path}\n\n${code}` : code)
      }
      if (d.kind === 'browser') {
        if (!view) return fail(t('canvas.tool.openCanvas'))
        const page = await view.executeJavaScript(
          'document.title + "\\n\\n" + (document.body ? document.body.innerText : "")',
        )
        return text(`${view.getURL()}\n${String(page)}`)
      }
      if (!session) return fail(t('canvas.tool.openCanvas'))
      return text(session.snapshot())
    }
    case 'write': {
      const value = call.args.text ?? ''
      if (d.kind === 'note') {
        patchNode(node.id, (cur) =>
          cur.kind === 'note'
            ? {
                ...cur,
                text: (call.args.mode === 'append' ? `${cur.text}${value}` : value).slice(
                  0,
                  20_000,
                ),
              }
            : cur,
        )
        return text(t('canvas.tool.written'))
      }
      if (d.kind === 'code') {
        const handle = codeHandles.get(node.id)
        if (!handle) return fail(t('canvas.tool.openCanvas'))
        handle.setText(call.args.mode === 'append' ? handle.text() + value : value)
        if (handle.save && !(await handle.save())) return fail(t('canvas.tool.saveFailed'))
        return text(t('canvas.tool.written'))
      }
      return fail(t('canvas.tool.notWritable'))
    }
    case 'send': {
      if (d.kind !== 'terminal' && d.kind !== 'agent') return fail(t('canvas.tool.notTerminal'))
      if (!session?.isRunning()) return fail(t('canvas.tool.openCanvas'))
      session.type(call.args.text ?? '')
      // Enter separado: os CLIs de agente tratam texto que chega de uma vez como colado.
      await new Promise((r) => setTimeout(r, 150))
      session.type('\r')
      return text(t('canvas.tool.sent'))
    }
    case 'navigate': {
      if (d.kind !== 'browser') return fail(t('canvas.tool.notBrowser'))
      if (!view) return fail(t('canvas.tool.openCanvas'))
      const url = toBrowserUrl(call.args.url ?? '')
      if (!url) return fail(t('canvas.invalidAddress'))
      await view.loadURL(url).catch(() => {})
      const title = await view.executeJavaScript('document.title').catch(() => '')
      return text(`${view.getURL()}\n${String(title)}`)
    }
    case 'screenshot': {
      if (d.kind !== 'browser') return fail(t('canvas.tool.notBrowser'))
      if (!view) return fail(t('canvas.tool.openCanvas'))
      const res = await window.api.canvas.capture(
        (view as unknown as { getWebContentsId: () => number }).getWebContentsId(),
      )
      if (!res.ok) return fail(res.error.message)
      return ok({ type: 'image', data: res.data, mimeType: 'image/png' })
    }
  }
}
