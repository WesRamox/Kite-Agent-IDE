import { realpath } from 'node:fs/promises'
import path from 'node:path'
import type { AgentReview, AgentSession, GitDiff } from '@shared/types'
import { z } from 'zod'
import { AppException } from '../lib/errors'
import type { JsonStore } from '../lib/json-store'
import { isInside } from '../lib/workspace-guard'
import type { GitReviewService } from './git-review.service'
import { t } from '../lib/i18n'

// Itens de "Para revisar" que o usuário dispensou, com a hora em que dispensou.
export const reviewStateSchema = z.object({ dismissed: z.record(z.string(), z.number()) })
export type ReviewState = z.infer<typeof reviewStateSchema>

export interface SessionReviewServiceDeps {
  session: (id: string) => AgentSession | undefined
  review: Pick<GitReviewService, 'pendingFiles' | 'diffSince'>
  store: Pick<JsonStore<ReviewState>, 'read' | 'write'>
  now?: () => number
  // Dispensas mais antigas que isso são esquecidas (o item já saiu da lista).
  keepMs?: number
}

interface PendingFile {
  toplevel: string
  rel: string
  abs: string
  status: AgentReview['files'][number]['status']
}

// Revisão de sessões de agentes que não pertencem a uma tarefa: o que o agente editou e ainda não
// foi commitado. Só os arquivos que a própria sessão editou podem ser lidos daqui.
export class SessionReviewService {
  constructor(private readonly deps: SessionReviewServiceDeps) {}

  async review(id: string): Promise<AgentReview> {
    const s = this.session(id)
    const cwd = await realpath(s.cwd).catch(() => s.cwd)
    const files = await this.pending(s)
    return {
      base: 'HEAD',
      mergeBase: 'HEAD',
      files: files.map((f) => ({ path: display(f.abs, cwd), status: f.status })),
    }
  }

  async diff(id: string, file: string): Promise<GitDiff> {
    const s = this.session(id)
    const cwd = await realpath(s.cwd).catch(() => s.cwd)
    const abs = path.resolve(cwd, file)
    const found = (await this.pending(s)).find((f) => f.abs === abs)
    if (!found) throw new AppException('FORBIDDEN_PATH', t('error.notEditedBySession'))
    return this.deps.review.diffSince(found.toplevel, 'HEAD', found.rel)
  }

  // Quantos arquivos editados por cada sessão ainda têm alterações não commitadas.
  async pendingCounts(ids: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {}
    for (const id of ids) {
      const s = this.deps.session(id)
      if (!s) continue
      // Contagem para o selo da Central: repositório inacessível conta como nada pendente.
      counts[id] = (await this.pending(s).catch(() => [])).length
    }
    return counts
  }

  async dismissed(): Promise<string[]> {
    return Object.keys(await this.prune())
  }

  async dismiss(key: string): Promise<string[]> {
    const dismissed = { ...(await this.prune()), [key]: this.now() }
    await this.deps.store.write({ dismissed })
    return Object.keys(dismissed)
  }

  private async prune(): Promise<Record<string, number>> {
    const keep = this.deps.keepMs ?? 7 * 24 * 60 * 60 * 1000
    const { dismissed } = await this.deps.store.read()
    return Object.fromEntries(Object.entries(dismissed).filter(([, at]) => this.now() - at < keep))
  }

  private async pending(s: AgentSession): Promise<PendingFile[]> {
    const files = await this.deps.review.pendingFiles(s.touchedPaths)
    return files.map((f) => ({ ...f, abs: path.join(f.toplevel, ...f.rel.split('/')) }))
  }

  private session(id: string): AgentSession {
    const s = this.deps.session(id)
    if (!s) throw new AppException('NOT_FOUND', t('error.sessionNotFound'))
    return s
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }
}

// Caminho relativo à pasta da sessão quando está dentro dela; senão, o absoluto.
function display(abs: string, cwd: string): string {
  return isInside(cwd, abs) && abs !== cwd ? path.relative(cwd, abs).split(path.sep).join('/') : abs
}
