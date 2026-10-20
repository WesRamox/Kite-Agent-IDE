import { describe, expect, it } from 'vitest'
import { AppException } from './errors'
import {
  addExtraRepo,
  assignWorktree,
  DEFAULT_CONFIG,
  importTasks,
  isPending,
  markSeen,
  linkSession,
  removeManualTask,
  removeRepo,
  renameTask,
  restoreRepo,
  setHidden,
} from './task-config'

const base = DEFAULT_CONFIG

describe('renameTask', () => {
  it('guarda o nome sem espaços e o aplica também à tarefa manual', () => {
    const c = assignWorktree(base, '/wt/a', 'manual:1', { id: 'manual:1', name: 'velho' })
    const next = renameTask(c, 'manual:1', '  novo  ')
    expect(next.overrides.names).toEqual({ 'manual:1': 'novo' })
    expect(next.overrides.manual).toEqual([{ id: 'manual:1', name: 'novo' }])
  })

  it('nome vazio volta ao nome descoberto', () => {
    const named = renameTask(base, 't1', 'X')
    expect(renameTask(named, 't1', '   ').overrides.names).toEqual({})
  })
})

describe('assignWorktree', () => {
  it('cria a tarefa manual só quando pedida e move a worktree', () => {
    const c = assignWorktree(base, '/wt/a', 'manual:1', { id: 'manual:1', name: 'A' })
    const d = assignWorktree(c, '/wt/b', 'manual:1')
    expect(d.overrides.manual).toHaveLength(1)
    expect(d.overrides.moves).toEqual({ '/wt/a': 'manual:1', '/wt/b': 'manual:1' })
  })
})

describe('setHidden e importTasks', () => {
  it('esconde e mostra sem duplicar', () => {
    const hidden = setHidden(setHidden(base, 't1', true), 't1', true)
    expect(hidden.overrides.hidden).toEqual(['t1'])
    expect(setHidden(hidden, 't1', false).overrides.hidden).toEqual([])
  })

  const t1 = { id: 't1', worktrees: [{ path: '/wt/a' }] }
  const t3 = { id: 't3', worktrees: [{ path: '/wt/d' }] }
  const tasks = [t1, { id: 't2', worktrees: [{ path: '/wt/b' }, { path: '/wt/c' }] }, t3]

  it('importar marca a descoberta como concluída e esconde as descartadas', () => {
    const c = importTasks(base, tasks, ['t2'], ['t1', 't1'])
    expect(c.imported).toBe(true)
    expect(c.overrides.hidden).toEqual(['t1'])
    expect(c.seenWorktrees).toEqual(['/wt/a', '/wt/b', '/wt/c'])
  })

  it('antes da primeira importação tudo é novo; depois, só tarefa com worktrees nunca vistas', () => {
    expect(tasks.every((t) => isPending(base, t))).toBe(true)
    const c = importTasks(base, tasks, ['t1', 't2'], [])
    expect(tasks.map((t) => isPending(c, t))).toEqual([false, false, true])
  })

  it('tarefa reagrupada com outro id continua importada se já tinha worktree vista', () => {
    const c = importTasks(base, tasks, ['t1'], [])
    expect(isPending(c, { id: 'outro', worktrees: [{ path: '/wt/a' }, { path: '/wt/z' }] })).toBe(
      false,
    )
  })

  it('reimportar uma descartada a mostra de novo; worktrees que sumiram saem da lista', () => {
    const c = importTasks(base, tasks, [], ['t1'])
    const d = importTasks(c, tasks.slice(1), ['t1'], [])
    expect(d.overrides.hidden).toEqual([])
    expect(d.seenWorktrees).toEqual([])
  })

  it('perfil antigo (sem a lista) já importado: nada é novo', () => {
    expect(isPending({ ...base, imported: true }, t3)).toBe(false)
  })

  it('tarefa criada pelo Kite já nasce vista', () => {
    const c = markSeen(base, ['/wt/d', '/wt/d'])
    expect(c.imported).toBe(true)
    expect(isPending(c, t3)).toBe(false)
    expect(isPending(c, t1)).toBe(true)
  })
})

describe('repos do workspace', () => {
  it('repo de outra pasta sai da lista; repo da varredura fica ignorado', () => {
    const c = addExtraRepo(base, '/fora/api')
    expect(removeRepo(c, '/fora/api').extraRepos).toEqual([])
    const ignored = removeRepo(base, '/ws/web')
    expect(ignored.ignoredRepos).toEqual(['/ws/web'])
    expect(restoreRepo(ignored, '/ws/web').ignoredRepos).toEqual([])
  })
})

describe('linkSession', () => {
  it('liga, troca e desfaz a ligação da sessão', () => {
    const a = linkSession(base, 's1', 't1')
    expect(linkSession(a, 's1', 't2').sessionLinks).toEqual({ s1: 't2' })
    expect(linkSession(a, 's1', null).sessionLinks).toEqual({})
  })
})

describe('removeManualTask', () => {
  it('apaga tudo que aponta para a tarefa', () => {
    let c = assignWorktree(base, '/wt/a', 'manual:1', { id: 'manual:1', name: 'A' })
    c = renameTask(c, 'manual:1', 'B')
    c = setHidden(c, 'manual:1', true)
    c = linkSession(c, 's1', 'manual:1')
    c = { ...c, notes: { 'manual:1': 'nota' } }
    const next = removeManualTask(c, 'manual:1')
    expect(next.overrides).toMatchObject({ manual: [], moves: {}, names: {}, hidden: [] })
    expect(next.notes).toEqual({})
    expect(next.sessionLinks).toEqual({})
  })

  it('recusa tarefa descoberta pela heurística', () => {
    expect(() => removeManualTask(base, 'folder:x')).toThrow(AppException)
  })
})
