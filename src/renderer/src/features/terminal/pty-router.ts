import type { PtyDataEvent, PtyExitEvent } from '@shared/types'

// Encaminha os eventos de PTY (um único listener IPC) para a sessão dona de cada id.
// Saída que chega antes do registro da sessão fica guardada até ela se registrar.

interface Handlers {
  data: (event: PtyDataEvent) => void
  exit: (event: PtyExitEvent) => void
}

const handlers = new Map<string, Handlers>()
const early = new Map<string, PtyDataEvent[]>()
let installed = false

function install(): void {
  if (installed) return
  installed = true
  window.api.pty.onData((event) => {
    const h = handlers.get(event.id)
    if (h) h.data(event)
    else early.set(event.id, [...(early.get(event.id) ?? []), event])
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

// Parte de um trecho que ainda não foi escrita, dado o offset já mostrado (`shown`).
export function unseenPart(event: PtyDataEvent, shown: number): string {
  if (event.end <= shown) return ''
  const start = event.end - event.data.length
  return start >= shown ? event.data : event.data.slice(shown - start)
}
