import type { DockviewApi, IDockviewPanel } from 'dockview-react'

// Instâncias do dockview da área principal, uma por contexto: o workspace e cada tarefa aberta
// (Fase 8). Cada contexto guarda as próprias abas e terminais; trocar de tarefa só troca qual
// dock está visível. As ações (abrir arquivo, fechar aba) agem no dock ativo.
export const WORKSPACE_CONTEXT = 'workspace'

const docks = new Map<string, DockviewApi>()
let active = WORKSPACE_CONTEXT

export function registerDock(context: string, api: DockviewApi): void {
  docks.set(context, api)
}

export function unregisterDock(context: string): void {
  docks.delete(context)
}

export function setActiveContext(context: string): void {
  active = context
}

export function activeContext(): string {
  return active
}

export function getDockApi(): DockviewApi | null {
  return docks.get(active) ?? null
}

export function getDock(context: string): DockviewApi | null {
  return docks.get(context) ?? null
}

export function allDocks(): DockviewApi[] {
  return [...docks.values()]
}

// Painel em qualquer contexto, preferindo o ativo.
export function findPanel(id: string): { dock: DockviewApi; panel: IDockviewPanel } | null {
  const ordered = [getDockApi(), ...allDocks()].filter((d): d is DockviewApi => d !== null)
  for (const dock of ordered) {
    const panel = dock.getPanel(id)
    if (panel) return { dock, panel }
  }
  return null
}

// Contexto (dock) em que um painel está aberto, se estiver.
export function contextOfPanel(id: string): string | null {
  for (const [context, dock] of docks) if (dock.getPanel(id)) return context
  return null
}

// Testes e o MainArea antigo: registra no contexto ativo.
export function setDockApi(api: DockviewApi | null): void {
  if (api) docks.set(active, api)
  else docks.delete(active)
}
