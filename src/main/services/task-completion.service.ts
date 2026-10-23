import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  RemovedWorktree,
  RemoveWorktreesResult,
  Task,
  TaskWorktree,
  WorkspaceTasks,
} from '@shared/types'
import { AppException } from '../lib/errors'
import { execGit, type GitRunner } from '../lib/git-exec'
import { t } from '../lib/i18n'
import type { Logger } from '../lib/logger'
import * as cfgOps from '../lib/task-config'
import type { WorkspaceTaskConfig } from '../lib/task-config'
import { isInside } from '../lib/workspace-guard'

export interface TaskCompletionServiceDeps {
  tasks: {
    discover: (root: string) => Promise<WorkspaceTasks>
    update: (
      root: string,
      fn: (c: WorkspaceTaskConfig) => WorkspaceTaskConfig,
    ) => Promise<WorkspaceTasks>
  }
  run: GitRunner
  // Move para a lixeira do SO (shell.trashItem no Electron).
  trash: (target: string) => Promise<void>
  guard: { removeRoot: (dir: string) => void }
  log: Logger
  // Espera entre tentativas de remover uma worktree (no Windows, um terminal recém-fechado
  // ainda segura a pasta por um instante).
  retryDelayMs?: number
}

// Arquivos que o Kite e as skills deixam na pasta da tarefa: sobrando só eles, a pasta vai junto.
const TASK_META_FILES = new Set(['TASK.md', '.kite-task.json'])
const REMOVE_ATTEMPTS = 3

// Concluir uma tarefa e, depois, excluir as worktrees dela. As branches nunca são apagadas.
export class TaskCompletionService {
  constructor(private readonly deps: TaskCompletionServiceDeps) {}

  setDone(root: string, taskId: string, done: boolean): Promise<WorkspaceTasks> {
    return this.deps.tasks.update(root, (c) => cfgOps.setDone(c, taskId, done))
  }

  // Sem `force`, não apaga nada se algum repo tiver alterações não commitadas: devolve quais
  // são, para o renderer confirmar de novo. Falha num repo não interrompe os outros.
  async removeWorktrees(
    root: string,
    taskId: string,
    force: boolean,
  ): Promise<RemoveWorktreesResult> {
    const ws = await this.deps.tasks.discover(root)
    const task = ws.tasks.find((x) => x.id === taskId)
    if (!task) throw new AppException('NOT_FOUND', t('error.taskNotFound'))
    if (!task.done) throw new AppException('INVALID_ARGS', t('error.taskNotDone'))
    // A pasta aberta pode ser ela mesma uma worktree (ou estar dentro de uma).
    if (task.worktrees.some((w) => isInside(w.path, root))) {
      throw new AppException('FORBIDDEN_PATH', t('error.cannotRemoveOpenWorktree'))
    }
    if (!force) {
      const dirty = await this.dirtyRepos(task.worktrees)
      if (dirty.length > 0) return { kind: 'dirty', repos: dirty }
    }
    const worktrees: RemovedWorktree[] = []
    for (const w of task.worktrees) {
      const error = await this.removeOne(w, force)
      if (error === null) this.deps.guard.removeRoot(w.path)
      worktrees.push({ repoName: w.repoName, path: w.path, error })
    }
    const removed = worktrees.filter((w) => w.error === null).map((w) => w.path)
    const all = removed.length === task.worktrees.length
    const folderTrashed = all ? await this.trashTaskFolder(root, task) : false
    this.deps.log.info('worktrees da tarefa excluídas', {
      removed: removed.length,
      failed: worktrees.length - removed.length,
      folderTrashed,
    })
    const workspace = await this.deps.tasks.update(root, (c) => {
      const next = cfgOps.forgetWorktrees(c, removed)
      return all ? cfgOps.forgetTask(next, taskId) : next
    })
    return { kind: 'removed', worktrees, folderTrashed, workspace }
  }

  // Status que falha conta como alterado: na dúvida, o usuário confirma antes do --force.
  private async dirtyRepos(worktrees: TaskWorktree[]): Promise<string[]> {
    const checks = await Promise.all(
      worktrees.map(async (w) => {
        const out = await this.deps
          .run(w.path, ['status', '--porcelain'])
          .catch(() => 'desconhecido')
        return out.trim() ? w.repoName : null
      }),
    )
    return checks.filter((r) => r !== null)
  }

  // Devolve a mensagem do git quando não conseguiu remover, ou null.
  private async removeOne(w: TaskWorktree, force: boolean): Promise<string | null> {
    const args = ['worktree', 'remove', ...(force ? ['--force'] : []), w.path]
    let message = ''
    for (let attempt = 1; attempt <= REMOVE_ATTEMPTS; attempt++) {
      try {
        await execGit(this.deps.run, w.repo, args)
        return null
      } catch (err) {
        message = err instanceof Error ? err.message : String(err)
        if (attempt < REMOVE_ATTEMPTS) await delay(this.deps.retryDelayMs ?? 400)
      }
    }
    this.deps.log.warn('falha ao remover worktree da tarefa', { path: w.path, error: message })
    return message
  }

  // A pasta da tarefa (ex.: .worktrees/PAY-412) vai para a lixeira só se sobraram nela os
  // arquivos de título e resumo. Nunca a pasta aberta nem uma pasta que a contenha.
  private async trashTaskFolder(root: string, task: Task): Promise<boolean> {
    const folder = task.folder
    if (!folder || isInside(folder, root)) return false
    const entries = await readdir(folder).catch(() => null)
    if (!entries || entries.some((e) => !TASK_META_FILES.has(e))) return false
    try {
      await this.deps.trash(path.resolve(folder))
      this.deps.guard.removeRoot(folder)
      return true
    } catch (err) {
      // As worktrees já saíram; a pasta com o TASK.md fica e o renderer avisa.
      this.deps.log.warn('falha ao mover a pasta da tarefa para a lixeira', {
        path: folder,
        error: err instanceof Error ? err.message : String(err),
      })
      return false
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
