import type { PtyExitEvent } from '@shared/types'

// Encaminha os eventos de PTY (um único listener IPC) para a sessão dona de cada id.
// Saída que chega antes do registro da sessão fica guardada até ela se registrar.

interface Handlers {
  data: (data: string) => void
  exit: (event: PtyExitEvent) => void
}

const handlers = new Map<string, Handlers>()
const early = new Map<string, string[]>()
let installed = false

function install(): void {
  if (installed) return
  installed = true
  window.api.pty.onData(({ id, data }) => {
    const h = handlers.get(id)
    if (h) h.data(data)
    else early.set(id, [...(early.get(id) ?? []), data])
  })
  window.api.pty.onExit((event) => {
    early.delete(event.id)
    handlers.get(event.id)?.exit(event)
    handlers.delete(event.id)
  })
}

export function routePty(id: string, h: Handlers): () => void {
  install()
  handlers.set(id, h)
  for (const chunk of early.get(id) ?? []) h.data(chunk)
  early.delete(id)
  return () => {
    handlers.delete(id)
  }
}
