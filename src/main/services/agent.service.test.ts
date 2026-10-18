import { execFileSync } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentTask } from '@shared/types'
import { createGitRunner } from '../lib/git-runner'
import { agentStateSchema } from '../lib/agent-schemas'
import { JsonStore } from '../lib/json-store'
import { WorkspaceGuard } from '../lib/workspace-guard'
import { makeTree } from '../test/tmp'
import { AgentService, type AgentState } from './agent.service'
import { GitReviewService } from './git-review.service'
import { GitService } from './git.service'
import type { SpawnSpec } from './pty.service'

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' })

describe('AgentService', () => {
  let base: string
  let repo: string
  let cleanup: () => Promise<void>
  let clock: number
  let spawned: (SpawnSpec & { id: string })[]
  let written: [string, string][]
  let killed: string[]
  let emitted: (AgentTask & { removed?: boolean })[]
  let notified: [string, string][]
  let store: JsonStore<AgentState>
  let svc: AgentService

  const make = () =>
    new AgentService({
      git: new GitService({ guard, run: createGitRunner(ENV) }),
      review: new GitReviewService({ run: createGitRunner(ENV) }),
      pty: {
        spawnAt: (spec) => {
          const id = `pty-${spawned.length + 1}`
          spawned.push({ ...spec, id })
          return { id, pid: 1000 + spawned.length }
        },
        write: (id, data) => void written.push([id, data]),
        kill: (id) => void killed.push(id),
      },
      shell: { file: '/bin/bash', args: [] },
      platform: 'linux',
      store,
      emit: (t) => void emitted.push({ ...t }),
      notify: (t) => void notified.push([t.name, t.status]),
      now: () => clock,
      idleMs: 1000,
    })
  let guard: WorkspaceGuard

  beforeEach(async () => {
    ;({ dir: base, cleanup } = await makeTree({ 'repo/a.txt': 'a\n' }))
    repo = path.join(base, 'repo')
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'inicial')
    guard = new WorkspaceGuard()
    await guard.addRoot(repo)
    clock = 0
    spawned = []
    written = []
    killed = []
    emitted = []
    notified = []
    store = new JsonStore<AgentState>(path.join(base, 'agents.json'), agentStateSchema, {
      presets: [],
      tasks: [],
    })
    svc = make()
    await svc.init()
  })
  afterEach(async () => {
    await svc.flush()
    await cleanup()
  })

  it('nova tarefa cria branch, worktree e roda o agente nela com o prompt', async () => {
    const task = await svc.start({
      root: repo,
      name: 'Corrigir login',
      presetId: 'claude',
      prompt: "use 'aspas'",
    })
    expect(task).toMatchObject({
      branch: 'agent/corrigir-login',
      baseBranch: 'main',
      status: 'running',
      alive: true,
      repoPath: repo,
    })
    expect((await stat(task.worktreePath)).isDirectory()).toBe(true)
    expect(git(task.worktreePath, 'branch', '--show-current').trim()).toBe('agent/corrigir-login')
    expect(spawned[0]).toMatchObject({
      cwd: task.worktreePath,
      file: '/bin/bash',
      args: ['-ilc', `claude 'use '\\''aspas'\\'''`],
    })
  })

  it('nomes repetidos ganham sufixo', async () => {
    await svc.start({ root: repo, name: 'x', presetId: 'claude', prompt: '' })
    const second = await svc.start({ root: repo, name: 'x', presetId: 'claude', prompt: '' })
    expect(second.branch).toBe('agent/x-2')
  })

  it('status: running → waiting (notifica) → running → done (notifica)', async () => {
    const task = await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    svc.onPtyData({ id: 'pty-1', data: 'pensando…', end: 9 })
    clock = 1500
    svc.tick()
    expect(svc.list()[0]?.status).toBe('waiting')
    expect(notified).toEqual([['t', 'waiting']])

    clock = 2000
    svc.onPtyData({ id: 'pty-1', data: 'editando arquivos', end: 26 })
    expect(svc.list()[0]?.status).toBe('running')

    svc.onPtyExit({ id: 'pty-1', exitCode: 0 })
    expect(svc.list()[0]).toMatchObject({
      status: 'done',
      alive: false,
      exitCode: 0,
      endedAt: 2000,
    })
    expect(notified.at(-1)).toEqual(['t', 'done'])
    expect(emitted.at(-1)?.id).toBe(task.id)
  })

  it('com hooks, o status vem do CLI e a heurística do terminal é ignorada', async () => {
    const task = await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    expect(spawned[0]?.env).toMatchObject({ KITE_AGENT_ID: task.id })
    expect(svc.isLive(task.id)).toBe(true)
    svc.applyHookStatus(task.id, 'waiting')
    expect(svc.list()[0]?.status).toBe('waiting')
    expect(notified).toEqual([['t', 'waiting']])
    // Saída no terminal não volta para running: só um hook faz isso.
    svc.onPtyData({ id: 'pty-1', data: 'redesenhando a tela', end: 19 })
    expect(svc.list()[0]?.status).toBe('waiting')
    svc.applyHookStatus(task.id, 'running')
    clock = 5000
    svc.tick()
    expect(svc.list()[0]?.status).toBe('running')
    svc.onPtyExit({ id: 'pty-1', exitCode: 0 })
    expect(svc.isLive(task.id)).toBe(false)
  })

  it('agente na pasta de uma tarefa multi-repo: sem worktree própria, e remover não apaga a pasta', async () => {
    const folder = path.join(base, 'tarefa')
    const task = svc.startIn({
      cwd: folder,
      name: 'Estorno',
      presetId: 'claude',
      prompt: 'comece',
      repoPath: repo,
      branch: 'PAY-415',
      wsTaskId: 'folder:/x',
    })
    expect(task).toMatchObject({
      worktreePath: folder,
      branch: 'PAY-415',
      wsTaskId: 'folder:/x',
      alive: true,
    })
    expect(spawned[0]).toMatchObject({ cwd: folder })
    await svc.remove(task.id, true)
    expect(svc.list()).toEqual([])
  })

  it('código de saída diferente de zero vira error', async () => {
    await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    svc.onPtyExit({ id: 'pty-1', exitCode: 2 })
    expect(svc.list()[0]).toMatchObject({ status: 'error', exitCode: 2 })
  })

  it('preset no modo type: digita o prompt na primeira pausa, sem notificar', async () => {
    await svc.savePresets([
      {
        id: 'custom',
        name: 'Meu',
        command: 'meu-agente --tui',
        promptMode: 'type',
        promptFlag: '',
      },
    ])
    await svc.start({ root: repo, name: 't', presetId: 'custom', prompt: 'olá agente' })
    expect(spawned[0]?.args).toEqual(['-ilc', 'meu-agente --tui'])
    clock = 1500
    svc.tick()
    expect(written).toEqual([['pty-1', 'olá agente\r']])
    expect(notified).toEqual([])
    expect(svc.list()[0]?.status).toBe('running')
  })

  it('recusa preset sem comando', async () => {
    await expect(
      svc.start({ root: repo, name: 't', presetId: 'custom', prompt: '' }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGS',
    })
  })

  it('attach devolve o histórico e o offset', async () => {
    await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    svc.onPtyData({ id: 'pty-1', data: 'abc', end: 3 })
    svc.onPtyData({ id: 'pty-1', data: 'de', end: 5 })
    expect(svc.attach(svc.list()[0]?.id ?? '')).toEqual({
      ptyId: 'pty-1',
      history: 'abcde',
      end: 5,
    })
  })

  it('stop encerra como done e ignora o exit que vem depois', async () => {
    const task = await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    svc.stop(task.id)
    expect(killed).toEqual(['pty-1'])
    expect(svc.list()[0]).toMatchObject({ status: 'done', alive: false })
    svc.onPtyExit({ id: 'pty-1', exitCode: 137 })
    expect(svc.list()[0]?.status).toBe('done')
  })

  it('restart reabre o agente na mesma worktree', async () => {
    const task = await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: 'x' })
    svc.onPtyExit({ id: 'pty-1', exitCode: 0 })
    await svc.restart(task.id)
    expect(spawned[1]).toMatchObject({ cwd: task.worktreePath, args: ['-ilc', 'claude'] })
    expect(svc.list()[0]).toMatchObject({ status: 'running', alive: true, exitCode: null })
  })

  it('revisão lista o que mudou na worktree e mostra o diff', async () => {
    const task = await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    await writeFile(path.join(task.worktreePath, 'a.txt'), 'pelo agente\n')
    await writeFile(path.join(task.worktreePath, 'novo.ts'), 'x\n')
    const review = await svc.review(task.id)
    expect(review).toMatchObject({
      base: 'main',
      files: [
        { path: 'a.txt', status: 'modified' },
        { path: 'novo.ts', status: 'untracked' },
      ],
    })
    await expect(svc.reviewDiff(task.id, 'a.txt')).resolves.toMatchObject({
      original: 'a\n',
      modified: 'pelo agente\n',
    })
  })

  it('agente na pasta de uma tarefa: revisa contra a branch padrão, ou pede a revisão da tarefa', async () => {
    const wt = path.join(base, 'tarefa', 'repo')
    git(repo, 'worktree', 'add', '-q', '-b', 'PAY-1', wt)
    await writeFile(path.join(wt, 'a.txt'), 'pelo agente\n')
    const input = { name: 'PAY-1', presetId: 'claude', prompt: '', repoPath: repo, branch: 'PAY-1' }
    const one = svc.startIn({ ...input, cwd: wt, wsTaskId: 'folder:x' })
    await expect(svc.review(one.id)).resolves.toMatchObject({
      base: 'main',
      files: [{ path: 'a.txt', status: 'modified' }],
    })
    // Pasta com vários repos (não é um repositório): não há uma base só.
    const many = svc.startIn({ ...input, cwd: path.join(base, 'tarefa'), wsTaskId: 'folder:y' })
    await expect(svc.review(many.id)).rejects.toMatchObject({ code: 'NOT_A_REPO' })
  })

  it('remove a tarefa e, se pedido, a worktree', async () => {
    const task = await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    await writeFile(path.join(task.worktreePath, 'sujo.txt'), 'x')
    await svc.remove(task.id, true)
    expect(svc.list()).toEqual([])
    await expect(stat(task.worktreePath)).rejects.toThrow()
    expect(emitted.at(-1)).toMatchObject({ id: task.id, removed: true })
  })

  it('tarefas rodando ao fechar o app voltam como interrompidas', async () => {
    await svc.start({ root: repo, name: 't', presetId: 'claude', prompt: '' })
    await svc.shutdown()
    const reopened = make()
    await reopened.init()
    expect(reopened.list()[0]).toMatchObject({ alive: false, interrupted: true, status: 'error' })
  })

  it('presets editados persistem e os padrões continuam existindo', async () => {
    await svc.savePresets([
      {
        id: 'claude',
        name: 'Claude',
        command: 'claude --model opus',
        promptMode: 'arg',
        promptFlag: '',
      },
    ])
    const reopened = make()
    await reopened.init()
    expect(reopened.presets().find((p) => p.id === 'claude')?.command).toBe('claude --model opus')
    expect(reopened.presets().map((p) => p.id)).toEqual([
      'claude',
      'codex',
      'gemini',
      'opencode',
      'custom',
    ])
  })
})

void vi
