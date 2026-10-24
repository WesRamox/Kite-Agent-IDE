import path from 'node:path'
import type {
  SearchQuery,
  SearchRepo,
  SearchResult,
  TaskWorktree,
  WorkspaceTasks,
} from '@shared/types'
import { AppException } from '../lib/errors'
import { cleanGitMessage, type GitRunner } from '../lib/git-exec'
import { t } from '../lib/i18n'
import type { Logger } from '../lib/logger'
import { grepArgs, matcher, MAX_MATCHES, parseGrep } from '../lib/search-query'

export interface SearchServiceDeps {
  tasks: { discover: (root: string) => Promise<WorkspaceTasks> }
  run: GitRunner
  log: Logger
}

// Busca no conteúdo das worktrees de uma tarefa. O renderer passa só o id da tarefa; os
// caminhos saem da descoberta, no main.
export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  async searchTask(root: string, taskId: string, query: SearchQuery): Promise<SearchResult> {
    const ws = await this.deps.tasks.discover(root)
    const task = ws.tasks.find((x) => x.id === taskId)
    if (!task) throw new AppException('NOT_FOUND', t('error.taskNotFound'))
    // Todas terminam antes de decidir: com erro em mais de um repo, vale o primeiro na ordem da
    // tarefa, não o que chegou antes.
    const settled = await Promise.allSettled(task.worktrees.map((w) => this.grep(w, query)))
    const failed = settled.find((s) => s.status === 'rejected')
    if (failed) throw failed.reason
    const outputs = settled.map((s) => (s.status === 'fulfilled' ? s.value : ''))
    const re = matcher(query)
    const repos: SearchRepo[] = []
    let matches = 0
    let truncated = false
    task.worktrees.forEach((w, i) => {
      if (truncated) return
      const parsed = parseGrep(outputs[i] ?? '', w.path, re, MAX_MATCHES - matches, path.join)
      matches += parsed.matches
      truncated = parsed.truncated
      if (parsed.files.length > 0) {
        repos.push({ repoName: w.repoName, worktree: w.path, files: parsed.files })
      }
    })
    const files = repos.reduce((n, r) => n + r.files.length, 0)
    this.deps.log.debug('busca na tarefa', { repos: task.worktrees.length, files, matches })
    return { repos, files, matches, truncated }
  }

  // Sem ocorrências o git sai com código 1 e sem mensagem: a saída vem vazia. Erro de verdade
  // (regex inválida, filtro fora da worktree) vira mensagem para quem buscou.
  private async grep(w: TaskWorktree, query: SearchQuery): Promise<string> {
    try {
      return await this.deps.run(w.path, grepArgs(query))
    } catch (err) {
      throw new AppException(
        'INVALID_ARGS',
        t('error.searchFailed', { repo: w.repoName, reason: cleanGitMessage(err) }),
      )
    }
  }
}
