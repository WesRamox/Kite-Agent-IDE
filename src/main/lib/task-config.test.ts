import { describe, expect, it } from 'vitest'
import { AppException } from './errors'
import {
  addExtraRepo,
  assignWorktree,
  DEFAULT_CONFIG,
  importTasks,
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

  it('importar marca a descoberta como concluída', () => {
    const c = importTasks(base, ['t1', 't1'])
    expect(c.imported).toBe(true)
    expect(c.overrides.hidden).toEqual(['t1'])
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
