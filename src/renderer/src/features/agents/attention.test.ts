import type { AgentSession, AgentTask, Task } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  ago,
  attentionItems,
  doing,
  elapsed,
  groupItems,
  nextWaiting,
  reviewKey,
} from './attention'

const session = (patch: Partial<AgentSession> = {}): AgentSession => ({
  id: 's',
  cli: 'claude',
  cwd: '/home/ana/loja',
  status: 'running',
  waitReason: null,
  waitingSince: null,
  pending: null,
  activity: null,
  runningSince: 0,
  lastMessage: null,
  firstPrompt: null,
  touchedPaths: [],
  touchedCount: 0,
  agentTaskId: null,
  ptyId: null,
  startedAt: 0,
  lastEventAt: 0,
  endedAt: null,
  ...patch,
})

const task = (patch: Partial<AgentTask> = {}): AgentTask => ({
  id: 't1',
  name: 'Corrigir login',
  presetId: 'claude',
  presetName: 'Claude Code',
  branch: 'agent/corrigir-login',
  baseBranch: 'main',
  worktreePath: '/home/ana/loja-worktrees/agent-corrigir-login',
  repoPath: '/home/ana/loja',
  status: 'running',
  alive: true,
  interrupted: false,
  startedAt: 0,
  endedAt: null,
  exitCode: null,
  ...patch,
})

describe('attention', () => {
  it('agrupa sessões e agentes do Kite, sem duplicar a sessão de um agente do Kite', () => {
    const items = attentionItems(
      [
        session({ id: 'a', status: 'waiting', waitReason: 'permission', waitingSince: 5 }),
        session({
          id: 'b',
          status: 'waiting',
          waitReason: 'turn',
          agentTaskId: 't1',
          waitingSince: 9,
        }),
        session({ id: 'c', status: 'idle' }),
        session({ id: 'd', status: 'ended', touchedCount: 3, endedAt: 100 }),
        session({ id: 'e', status: 'ended', endedAt: 100 }),
      ],
      [
        task({ status: 'waiting' }),
        task({ id: 't2', alive: false, status: 'error', exitCode: 3 }),
        task({ id: 't3', alive: false, status: 'done' }),
      ],
      200,
    )
    const g = groupItems(items)
    expect(g.waiting.map((x) => x.id)).toEqual(['session:a', 'task:t1'])
    expect(g.waiting[1]).toMatchObject({ meta: 'sua vez', waitReason: 'turn', since: 9 })
    expect(g.review.map((x) => x.id).sort()).toEqual(['session:d', 'task:t3'])
    expect(g.idle).toMatchObject([{ id: 'task:t2', meta: 'erro (código 3)' }])
    expect(items.some((x) => x.id === 'session:c' || x.id === 'session:e')).toBe(false)
  })

  it('agente do Kite na pasta de uma tarefa aparece dentro do item da tarefa', () => {
    const ws: Task = {
      id: 'folder:/w/PAY',
      key: 'PAY-415',
      name: 'Estorno',
      cardUrl: null,
      source: 'folder',
      why: '',
      folder: '/w/PAY',
      worktrees: [
        { repo: '/w/api', repoName: 'api', path: '/w/PAY/api', branch: 'PAY-415', head: '' },
        { repo: '/w/web', repoName: 'web', path: '/w/PAY/web', branch: 'PAY-415', head: '' },
      ],
      hidden: false,
      notes: '',
    }
    const agent = task({ id: 'ag', status: 'waiting', wsTaskId: ws.id })
    const items = attentionItems([], [agent], 0, [ws])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'wstask:folder:/w/PAY',
      group: 'waiting',
      meta: 'api · web — esperando você',
      inKite: true,
    })
    expect(items[0]?.task?.id).toBe('ag')
    // Com hooks, a sessão do agente vale mais que a heurística.
    const withHook = attentionItems(
      [session({ id: 's', agentTaskId: 'ag', status: 'waiting', waitReason: 'permission' })],
      [agent],
      0,
      [ws],
    )
    expect(withHook[0]).toMatchObject({
      meta: 'api · web — pede permissão',
      waitReason: 'permission',
    })
    // Agente com erro: "Sem agente" com o motivo.
    const failed = attentionItems(
      [],
      [task({ id: 'ag', alive: false, status: 'error', exitCode: 3, wsTaskId: ws.id })],
      0,
      [ws],
    )
    expect(failed[0]).toMatchObject({ group: 'idle', meta: 'api · web — erro (código 3)' })
  })

  it('tira de "Para revisar" o que já foi commitado ou dispensado', () => {
    const ended = (id: string) =>
      session({ id, status: 'ended', touchedCount: 2, endedAt: 100, lastEventAt: 100 })
    const done = task({ id: 't9', alive: false, status: 'done', endedAt: 50 })
    const review = (pending: Record<string, number> | null, dismissed: string[]) =>
      groupItems(
        attentionItems([ended('a'), ended('b'), ended('c')], [done], 200, [], new Map(), {
          pending,
          dismissed: new Set(dismissed),
        }),
      ).review.map((i) => i.id)

    expect(review(null, [])).toEqual(['session:a', 'session:b', 'session:c', 'task:t9'])
    // a: tudo commitado; b: ainda há o que revisar; c: ainda não conferida.
    expect(review({ a: 0, b: 1 }, [])).toEqual(['session:b', 'task:t9'])
    expect(review({ a: 0, b: 1 }, ['session:c', 'task:t9:50'])).toEqual(['session:b'])
    const items = attentionItems([ended('a')], [done], 200)
    expect(items.map(reviewKey).sort()).toEqual(['session:a', 'task:t9:50'])
  })

  it('sessão num terminal do Kite pode ser respondida ali', () => {
    const [item] = attentionItems(
      [session({ ptyId: 'p1', status: 'waiting', waitReason: 'turn' })],
      [],
      0,
    )
    expect(item?.inKite).toBe(true)
  })

  it('Ctrl+J percorre quem espera, do que espera há mais tempo, e volta ao início', () => {
    const items = attentionItems(
      [
        session({ id: 'x', status: 'waiting', waitReason: 'turn', waitingSince: 20 }),
        session({ id: 'y', status: 'waiting', waitReason: 'turn', waitingSince: 10 }),
      ],
      [],
      0,
    )
    expect(nextWaiting(items, null)?.id).toBe('session:y')
    expect(nextWaiting(items, 'session:y')?.id).toBe('session:x')
    expect(nextWaiting(items, 'session:x')?.id).toBe('session:y')
    expect(nextWaiting([], null)).toBeNull()
  })

  it('descreve a atividade atual', () => {
    const [item] = attentionItems(
      [session({ activity: { tool: 'Edit', detail: '/home/ana/loja/infra/queue.tf' } })],
      [],
      0,
    )
    expect(item && doing(item)).toBe('Editando infra/queue.tf')
  })

  it('formata tempos', () => {
    expect(ago(30_000)).toBe('agora')
    expect(ago(6 * 60_000)).toBe('há 6 min')
    expect(ago(2 * 3600_000)).toBe('há 2 h')
    expect(elapsed(14 * 60_000)).toBe('14 min')
    expect(elapsed(65 * 60_000)).toBe('1 h 05 min')
  })
})
