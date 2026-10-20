import type { CanvasState, WorkspaceCanvas } from '@shared/types'
import { firstCanvas, type CanvasStore } from '../lib/canvas-schema'
import { AppException } from '../lib/errors'
import { t } from '../lib/i18n'
import type { JsonStore } from '../lib/json-store'
import type { WorkspaceGuard } from '../lib/workspace-guard'

export interface CanvasServiceDeps {
  guard: Pick<WorkspaceGuard, 'isRoot'>
  store: JsonStore<CanvasStore>
}

// Ligação com um bloco que não existe mais (ou com ele mesmo) não tem o que desenhar.
function withoutLooseEdges(state: CanvasState): CanvasState {
  const ids = new Set(state.nodes.map((n) => n.id))
  return {
    ...state,
    edges: state.edges.filter(
      (e) => e.source !== e.target && ids.has(e.source) && ids.has(e.target),
    ),
  }
}

// Workflows (quadros com nome) de cada pasta aberta, em userData/canvas.json.
export class CanvasService {
  // Gravações em fila: cada uma lê o arquivo e troca só os workflows da sua pasta.
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: CanvasServiceDeps) {}

  async load(root: string): Promise<WorkspaceCanvas> {
    this.checkRoot(root)
    return (await this.deps.store.read()).workspaces[root] ?? firstCanvas(t('canvas.firstName'))
  }

  async save(root: string, canvas: WorkspaceCanvas): Promise<void> {
    this.checkRoot(root)
    const boards = canvas.boards.map((b) => ({ ...b, state: withoutLooseEdges(b.state) }))
    // Workflow aberto que não está na lista: abre o primeiro.
    const active = boards.some((b) => b.id === canvas.active) ? canvas.active : boards[0]?.id
    if (!active) throw new AppException('INVALID_ARGS', t('error.invalidArgs'))
    const run = async () => {
      const current = await this.deps.store.read()
      await this.deps.store.write({
        workspaces: { ...current.workspaces, [root]: { active, boards } },
      })
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    await next
  }

  private checkRoot(root: string): void {
    if (!this.deps.guard.isRoot(root)) {
      throw new AppException('FORBIDDEN_PATH', t('error.notAnOpenFolder'))
    }
  }
}
