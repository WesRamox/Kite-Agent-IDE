import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import type {
  AgentAttach,
  AgentPreset,
  AgentReview,
  AgentStatus,
  AgentTask,
  GitDiff,
  PtyDataEvent,
  PtyExitEvent,
  StartAgentInput,
} from '@shared/types'
import { agentCommandLine, agentProcess, taskSlug } from '../lib/agent-command'
import { DEFAULT_PRESETS, mergePresets, restoreAgentState } from '../lib/agent-state'
import { StatusDetector } from '../lib/agent-status'
import { AppException } from '../lib/errors'
import type { JsonStore } from '../lib/json-store'
import type { ShellSpec } from '../lib/shell'
import type { GitService } from './git.service'
import type { PtyService } from './pty.service'
import { t } from '../lib/i18n'

export { DEFAULT_PRESETS } from '../lib/agent-state'

export interface AgentState {
  presets: AgentPreset[]
  tasks: AgentTask[]
}

export interface AgentServiceDeps {
  git: GitService
  pty: Pick<PtyService, 'spawnAt' | 'write' | 'kill'>
  shell: ShellSpec
  platform: string
  store: JsonStore<AgentState>
  emit: (task: AgentTask & { removed?: boolean }) => void
  notify: (task: AgentTask) => void
  now?: () => number
  // Sem saída por esse tempo: o agente está esperando input.
  idleMs?: number
  // Quanto da saída guardar para reconectar o terminal.
  historyChars?: number
}

interface Runtime {
  ptyId: string | null
  detector: StatusDetector
  history: string
  end: number
  // Prompt a digitar quando o agente ficar pronto (presets no modo 'type').
  pendingPrompt: string | null
  // O CLI manda hooks ao Kite: o status vem deles, não da heurística do terminal.
  hooked: boolean
}

const COLS = 120
const ROWS = 32
const NOTIFY_ON: ReadonlySet<AgentStatus> = new Set(['waiting', 'done', 'error'])

export class AgentService {
  private state: AgentState = { presets: DEFAULT_PRESETS, tasks: [] }
  private readonly runtimes = new Map<string, Runtime>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly deps: AgentServiceDeps) {}

  // Carrega o estado salvo. Agentes que estavam rodando quando o app fechou ficam marcados
  // como interrompidos (o processo não sobrevive ao app).
  async init(): Promise<void> {
    this.state = restoreAgentState(await this.deps.store.read(), this.now())
    await this.persist()
  }

  presets(): AgentPreset[] {
    return this.state.presets
  }

  async savePresets(presets: AgentPreset[]): Promise<AgentPreset[]> {
    this.state.presets = mergePresets(presets)
    await this.persist()
    return this.state.presets
  }

  list(): AgentTask[] {
    return this.state.tasks
  }

  // Nova tarefa: branch agent/<nome> + worktree + agente no PTY.
  async start(input: StartAgentInput): Promise<AgentTask> {
    const preset = this.preset(input.presetId)
    if (!preset.command.trim()) {
      throw new AppException('INVALID_ARGS', t('error.presetCommandMissing', { name: preset.name }))
    }
    const status = await this.deps.git.status(input.root)
    if (!status.isRepo) throw new AppException('NOT_A_REPO', t('error.openFolderNotARepo'))
    const baseBranch = status.branch ?? status.head
    if (!baseBranch) throw new AppException('GIT_ERROR', t('error.noCommits'))

    const branch = await this.uniqueBranch(input.root, `agent/${taskSlug(input.name)}`)
    const { path: worktreePath } = await this.deps.git.addWorktree(input.root, branch, true)
    const main = (await this.deps.git.worktrees(input.root)).find((w) => w.isMain)

    const task: AgentTask = {
      id: randomUUID(),
      name: input.name.trim(),
      presetId: preset.id,
      presetName: preset.name,
      branch,
      baseBranch,
      worktreePath,
      repoPath: main?.path ?? input.root,
      status: 'running',
      alive: true,
      interrupted: false,
      startedAt: this.now(),
      endedAt: null,
      exitCode: null,
    }
    this.state.tasks.unshift(task)
    this.spawn(task, preset, input.prompt)
    return task
  }

  stop(id: string): void {
    const task = this.task(id)
    const rt = this.runtimes.get(id)
    if (!task.alive || !rt?.ptyId) return
    const ptyId = rt.ptyId
    rt.ptyId = null // o exit que vier depois é ignorado
    this.deps.pty.kill(ptyId)
    this.finish(task, 'done', null)
  }

  async restart(id: string): Promise<AgentTask> {
    const task = this.task(id)
    if (task.alive) throw new AppException('INVALID_ARGS', t('error.agentStillRunning'))
    if (
      !(await stat(task.worktreePath).then(
        (s) => s.isDirectory(),
        () => false,
      ))
    ) {
      throw new AppException('NOT_FOUND', t('error.taskWorktreeGone'))
    }
    Object.assign(task, {
      status: 'running',
      alive: true,
      interrupted: false,
      startedAt: this.now(),
      endedAt: null,
      exitCode: null,
    } satisfies Partial<AgentTask>)
    this.spawn(task, this.preset(task.presetId), '')
    return task
  }

  // Agente na pasta de uma tarefa multi-repo (Fase 10): as worktrees já existem, criadas pela
  // tarefa; o processo só roda ali. `cwd` vem do main (TaskService), nunca do renderer.
  startIn(input: {
    cwd: string
    name: string
    presetId: string
    prompt: string
    repoPath: string
    branch: string
    wsTaskId: string
  }): AgentTask {
    const preset = this.preset(input.presetId)
    if (!preset.command.trim()) {
      throw new AppException('INVALID_ARGS', t('error.presetCommandMissing', { name: preset.name }))
    }
    const task: AgentTask = {
      id: randomUUID(),
      name: input.name.trim(),
      presetId: preset.id,
      presetName: preset.name,
      branch: input.branch,
      baseBranch: '',
      worktreePath: input.cwd,
      repoPath: input.repoPath,
      status: 'running',
      alive: true,
      interrupted: false,
      startedAt: this.now(),
      endedAt: null,
      exitCode: null,
      wsTaskId: input.wsTaskId,
    }
    this.state.tasks.unshift(task)
    this.spawn(task, preset, input.prompt)
    return task
  }

  async remove(id: string, removeWorktree: boolean): Promise<void> {
    const task = this.task(id)
    if (task.alive) this.stop(id)
    // A pasta de uma tarefa multi-repo não é uma worktree do agente: fica.
    if (removeWorktree && !task.wsTaskId)
      await this.deps.git.removeWorktreeAt(task.repoPath, task.worktreePath)
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id)
    this.runtimes.delete(id)
    this.deps.emit({ ...task, removed: true })
    await this.persist()
  }

  attach(id: string): AgentAttach {
    this.task(id)
    const rt = this.runtimes.get(id)
    return { ptyId: rt?.ptyId ?? null, history: rt?.history ?? '', end: rt?.end ?? 0 }
  }

  async review(id: string): Promise<AgentReview> {
    const task = this.task(id)
    const base = await this.reviewBase(task)
    const { mergeBase, files } = await this.deps.git.changesSince(task.worktreePath, base)
    return { base, mergeBase, files }
  }

  async reviewDiff(id: string, rel: string): Promise<GitDiff> {
    const task = this.task(id)
    const base = await this.reviewBase(task)
    const { mergeBase } = await this.deps.git.changesSince(task.worktreePath, base)
    return this.deps.git.diffSince(task.worktreePath, mergeBase, rel)
  }

  // Agentes abertos na pasta de uma tarefa (Fase 10) não guardam a base: quem sabe é a tarefa.
  // Fora do workspace dela, usa a branch padrão do repo; numa pasta com vários repos, não há uma
  // base só, e a revisão é a da tarefa.
  private async reviewBase(task: AgentTask): Promise<string> {
    if (task.baseBranch) return task.baseBranch
    const base = await this.deps.git.defaultBase(task.worktreePath)
    if (!base) throw new AppException('NOT_A_REPO', t('error.reviewInTaskWorkspace'))
    return base
  }

  // Saída de qualquer PTY: interessa só a dos agentes.
  onPtyData(event: PtyDataEvent): void {
    const found = this.byPty(event.id)
    if (!found) return
    const [task, rt] = found
    const limit = this.deps.historyChars ?? 500_000
    rt.history = (rt.history + event.data).slice(-limit)
    rt.end = event.end
    const next = rt.detector.output(event.data, this.now())
    if (next && !rt.hooked) this.update(task, next)
  }

  onPtyExit(event: PtyExitEvent): void {
    const found = this.byPty(event.id)
    if (!found) return
    const [task, rt] = found
    rt.ptyId = null
    const next = rt.detector.exit(event.exitCode)
    this.finish(task, next ?? (event.exitCode === 0 ? 'done' : 'error'), event.exitCode)
  }

  // Chamado periodicamente: detecta agentes ociosos (esperando input).
  tick(): void {
    const now = this.now()
    for (const task of this.state.tasks) {
      const rt = this.runtimes.get(task.id)
      if (!task.alive || !rt?.ptyId) continue
      const next = rt.detector.tick(now)
      if (next !== 'waiting') continue
      if (rt.pendingPrompt !== null) {
        // Primeira pausa: o CLI está pronto para receber o prompt inicial.
        this.deps.pty.write(rt.ptyId, `${rt.pendingPrompt}\r`)
        rt.pendingPrompt = null
        rt.detector.output('prompt enviado', now)
        continue
      }
      if (!rt.hooked) this.update(task, next)
    }
  }

  isLive(id: string): boolean {
    return (
      this.state.tasks.some((t) => t.id === id && t.alive) && Boolean(this.runtimes.get(id)?.ptyId)
    )
  }

  // Status vindo dos hooks do CLI (Fase 6): a partir do primeiro, a heurística é ignorada.
  applyHookStatus(id: string, status: 'running' | 'waiting'): void {
    const task = this.state.tasks.find((t) => t.id === id)
    const rt = this.runtimes.get(id)
    if (!task?.alive || !rt) return
    rt.hooked = true
    if (task.status !== status) this.update(task, status)
  }

  // App fechando: os processos vão morrer junto. Marca e salva antes.
  async shutdown(): Promise<void> {
    for (const task of this.state.tasks) {
      if (!task.alive) continue
      const rt = this.runtimes.get(task.id)
      if (rt) rt.ptyId = null
      Object.assign(task, { alive: false, interrupted: true, status: 'error', endedAt: this.now() })
    }
    await this.persist()
  }

  // Grava o estado pendente (usado ao encerrar e nos testes).
  flush(): Promise<void> {
    return this.persist()
  }

  private spawn(task: AgentTask, preset: AgentPreset, prompt: string): void {
    const windows = this.deps.platform === 'win32'
    const line = agentCommandLine(preset, prompt, windows)
    const proc = agentProcess(this.deps.shell, line, this.deps.platform)
    const { id } = this.deps.pty.spawnAt({
      cwd: task.worktreePath,
      file: proc.file,
      args: proc.args,
      cols: COLS,
      rows: ROWS,
      // KITE_AGENT_ID chega aos hooks do CLI e liga a sessão a esta tarefa.
      env: { KITE_AGENT_TASK: task.name, KITE_AGENT_ID: task.id },
    })
    this.runtimes.set(task.id, {
      ptyId: id,
      detector: new StatusDetector({ idleMs: this.deps.idleMs ?? 4000 }, this.now()),
      history: '',
      end: 0,
      pendingPrompt: preset.promptMode === 'type' && prompt.trim() ? prompt.trim() : null,
      hooked: false,
    })
    this.deps.emit(task)
    this.schedulePersist()
  }

  private update(task: AgentTask, status: AgentStatus): void {
    task.status = status
    this.deps.emit(task)
    if (NOTIFY_ON.has(status)) this.deps.notify(task)
    this.schedulePersist()
  }

  private finish(task: AgentTask, status: AgentStatus, exitCode: number | null): void {
    task.alive = false
    task.endedAt = this.now()
    task.exitCode = exitCode
    this.update(task, status)
  }

  private byPty(ptyId: string): [AgentTask, Runtime] | null {
    for (const [taskId, rt] of this.runtimes) {
      if (rt.ptyId === ptyId) {
        const task = this.state.tasks.find((t) => t.id === taskId)
        return task ? [task, rt] : null
      }
    }
    return null
  }

  private task(id: string): AgentTask {
    const task = this.state.tasks.find((t) => t.id === id)
    if (!task) throw new AppException('NOT_FOUND', t('error.taskNotFound'))
    return task
  }

  private preset(id: string): AgentPreset {
    const preset = this.state.presets.find((p) => p.id === id)
    if (!preset) throw new AppException('NOT_FOUND', t('error.presetNotFound'))
    return preset
  }

  private async uniqueBranch(root: string, base: string): Promise<string> {
    for (let i = 1; i < 100; i++) {
      const candidate = i === 1 ? base : `${base}-${i}`
      if (!(await this.deps.git.branchExists(root, candidate))) return candidate
    }
    throw new AppException('ALREADY_EXISTS', t('error.tooManyTasksWithName'))
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private schedulePersist(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.persist()
    }, 500)
  }

  private async persist(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    await this.deps.store.write(this.state)
  }
}
