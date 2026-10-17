import path from 'node:path'
import { AppException } from '../lib/errors'
import type { JsonStore } from '../lib/json-store'
import type { WorkspaceGuard } from '../lib/workspace-guard'
import { t } from '../lib/i18n'

export const MAX_RECENT = 10

export interface WorkspaceState {
  recent: string[]
}

export interface WorkspaceServiceDeps {
  guard: WorkspaceGuard
  store: JsonStore<WorkspaceState>
  pickFolder: () => Promise<string | null>
  // Chamado quando uma raiz deixa de estar aberta (para parar o watcher).
  onRootClosed: (root: string) => Promise<void>
  // A pasta é uma worktree do repositório de alguma raiz aberta?
  isKnownWorktree: (dir: string) => Promise<boolean>
}

// Controla qual pasta está aberta. O renderer nunca escolhe um caminho arbitrário:
// só o diálogo nativo ou a lista de recentes (mantida aqui no main) abrem uma raiz.
export class WorkspaceService {
  constructor(private readonly deps: WorkspaceServiceDeps) {}

  async openFolderDialog(): Promise<string | null> {
    const picked = await this.deps.pickFolder()
    return picked ? this.open(picked) : null
  }

  async openRecent(dir: string): Promise<string> {
    const { recent } = await this.deps.store.read()
    if (!recent.includes(dir)) throw new AppException('FORBIDDEN_PATH', t('error.notInRecent'))
    return this.open(dir)
  }

  // Abre uma worktree do repositório atual como workspace. Só aceita caminhos que o próprio
  // git lista como worktree das raízes abertas.
  async openWorktree(dir: string): Promise<string> {
    if (!(await this.deps.isKnownWorktree(dir))) {
      throw new AppException('FORBIDDEN_PATH', t('error.notWorktreeOfRepo'))
    }
    return this.open(dir)
  }

  async recent(): Promise<string[]> {
    return (await this.deps.store.read()).recent
  }

  async removeRecent(dir: string): Promise<string[]> {
    const recent = (await this.recent()).filter((p) => p !== dir)
    await this.deps.store.write({ recent })
    return recent
  }

  private async open(dir: string): Promise<string> {
    const real = await this.deps.guard.addRoot(path.resolve(dir))
    // MVP: uma raiz por vez. O guard já suporta várias (worktrees nas próximas fases).
    for (const root of this.deps.guard.getRoots()) {
      if (root === real) continue
      this.deps.guard.removeRoot(root)
      await this.deps.onRootClosed(root)
    }
    const recent = [real, ...(await this.recent()).filter((p) => p !== real)].slice(0, MAX_RECENT)
    await this.deps.store.write({ recent })
    return real
  }
}
