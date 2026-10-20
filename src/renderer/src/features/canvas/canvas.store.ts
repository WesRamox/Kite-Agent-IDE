import type { CanvasState } from '@shared/types'
import type { Edge, Viewport } from '@xyflow/react'
import { create } from 'zustand'
import type { FlowNode } from './canvas'

export type SaveStatus = 'saved' | 'saving' | 'error'

// Workflows da pasta aberta. O aberto fica no formato do React Flow (nodes, edges, viewport); os
// outros ficam guardados como foram salvos, em `others`.
interface CanvasStoreState {
  root: string | null
  active: string
  boards: { id: string; name: string }[]
  others: Record<string, CanvasState>
  nodes: FlowNode[]
  edges: Edge[]
  viewport: Viewport
  status: SaveStatus
  set: (patch: Partial<Omit<CanvasStoreState, 'set'>>) => void
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  root: null,
  active: '',
  boards: [],
  others: {},
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  status: 'saved',
  set: (patch) => set(patch),
}))
