import type { PtyDataEvent, PtyExitEvent } from '@shared/types'

// Encaminha os eventos de PTY (um único listener IPC) para as sessões de cada id: o terminal de um
// agente pode estar numa aba e no quadro ao mesmo tempo. Saída que chega antes do registro da
// primeira sessão fica guardada até ela se registrar.

interface Handlers {
  data: (event: PtyDataEvent) => void
  exit: (event: PtyExitEvent) => void
}

const handlers = new Map<string, Set<Handlers>>()
const early = new Map<string, PtyDataEvent[]>()
let installed = false

function install(): void {
  if (installed) return
  installed = true
  window.api.pty.onData((event) => {
    const hs = handlers.get(event.id)
    if (hs) for (const h of hs) h.data(event)
    else early.set(event.id, [...(early.get(event.id) ?? []), event])
  })
  window.api.pty.onExit((event) => {
    early.delete(event.id)
    for (const h of handlers.get(event.id) ?? []) h.exit(event)
    handlers.delete(event.id)
  })
}

export function routePty(id: string, h: Handlers): () => void {
  install()
  const set = handlers.get(id) ?? new Set<Handlers>()
  set.add(h)
  handlers.set(id, set)
  for (const chunk of early.get(id) ?? []) h.data(chunk)
  early.delete(id)
  return () => {
    set.delete(h)
    if (set.size === 0 && handlers.get(id) === set) handlers.delete(id)
  }
}

// Parte de um trecho que ainda não foi escrita, dado o offset já mostrado (`shown`).
export function unseenPart(event: PtyDataEvent, shown: number): string {
  if (event.end <= shown) return ''
  const start = event.end - event.data.length
  return start >= shown ? event.data : event.data.slice(shown - start)
}
