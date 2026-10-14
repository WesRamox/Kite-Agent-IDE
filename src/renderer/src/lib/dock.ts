import type { DockviewApi } from 'dockview-react'

// Referência à instância do dockview da área principal, usada pelas ações (abrir arquivo,
// fechar aba) fora da árvore React.
let api: DockviewApi | null = null

export function setDockApi(next: DockviewApi | null): void {
  api = next
}

export function getDockApi(): DockviewApi | null {
  return api
}
