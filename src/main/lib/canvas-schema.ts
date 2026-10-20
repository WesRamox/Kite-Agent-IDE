import { z } from 'zod'
import { isWebUrl } from '@shared/web-url'
import type { CanvasState, WorkspaceCanvas } from '@shared/types'

// Quadro vindo do renderer (e do disco): tudo com limite, e o navegador só com http(s).
const id = z.string().min(1).max(200)
const coord = z.number().finite().min(-1_000_000).max(1_000_000)
const size = z.number().finite().min(40).max(5000)
const side = z.enum(['top', 'right', 'bottom', 'left']).optional()

// Nome e cor que a pessoa dá a qualquer bloco.
const common = {
  label: z.string().trim().min(1).max(80).optional(),
  color: z.enum(['accent', 'info', 'success', 'warning', 'danger', 'merged']).optional(),
}

const nodeData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('agent'), agentId: id, ...common }),
  // Pastas e arquivos só são guardados aqui; quem abre o shell ou lê o arquivo confere se estão
  // dentro das pastas abertas.
  z.object({ kind: z.literal('terminal'), cwd: z.string().min(1).max(4096), ...common }),
  z.object({ kind: z.literal('browser'), url: z.string().max(4000).refine(isWebUrl), ...common }),
  z.object({
    kind: z.literal('note'),
    text: z.string().max(20_000),
    html: z.string().max(100_000).optional(),
    ...common,
  }),
  z.object({ kind: z.literal('summary'), taskId: z.string().min(1).max(4200), ...common }),
  z.object({
    kind: z.literal('code'),
    path: z.string().min(1).max(4096).optional(),
    text: z.string().max(200_000).optional(),
    language: z.string().max(40).optional(),
    ...common,
  }),
])

export const canvasStateSchema = z.object({
  nodes: z
    .array(z.object({ id, x: coord, y: coord, width: size, height: size, data: nodeData }))
    .max(200),
  edges: z
    .array(z.object({ id, source: id, target: id, sourceHandle: side, targetHandle: side }))
    .max(500),
  viewport: z.object({ x: coord, y: coord, zoom: z.number().finite().min(0.05).max(4) }),
})

export const workspaceCanvasSchema = z.object({
  active: id,
  boards: z
    .array(z.object({ id, name: z.string().trim().min(1).max(80), state: canvasStateSchema }))
    .min(1)
    .max(50),
})

export const canvasStoreSchema = z.object({
  workspaces: z.record(z.string(), workspaceCanvasSchema),
})

export type CanvasStore = z.infer<typeof canvasStoreSchema>

export const EMPTY_CANVAS: CanvasState = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }

// Pasta sem quadro ainda: um workflow vazio.
export function firstCanvas(name: string): WorkspaceCanvas {
  return { active: 'wf-1', boards: [{ id: 'wf-1', name, state: EMPTY_CANVAS }] }
}
