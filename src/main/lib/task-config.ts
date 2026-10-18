import { z } from 'zod'
import type { TaskGrouping } from '@shared/types'
import { AppException } from './errors'
import { t } from './i18n'
import { EMPTY_OVERRIDES } from './task-grouping'

// Ajustes do usuário por workspace (userData/tasks.json). Vencem a heurística de agrupamento.
const configSchema = z.object({
  grouping: z.object({
    mode: z.enum(['auto', 'pattern', 'manual']),
    pattern: z.string().max(200),
  }),
  overrides: z.object({
    names: z.record(z.string(), z.string().max(120)),
    moves: z.record(z.string(), z.string()),
    ignored: z.array(z.string()),
    manual: z.array(z.object({ id: z.string(), name: z.string().max(120) })),
    hidden: z.array(z.string()),
  }),
  extraRepos: z.array(z.string()),
  // Repos achados na varredura que o usuário tirou do workspace (ausente em perfis antigos).
  ignoredRepos: z.array(z.string()).optional(),
  imported: z.boolean(),
  notes: z.record(z.string(), z.string().max(20_000)),
  sessionLinks: z.record(z.string(), z.string()),
})

export type WorkspaceTaskConfig = z.infer<typeof configSchema>

export const taskStateSchema = z.object({ workspaces: z.record(z.string(), configSchema) })
export type TaskState = z.infer<typeof taskStateSchema>

export const DEFAULT_CONFIG: WorkspaceTaskConfig = {
  grouping: { mode: 'auto', pattern: '.worktrees/{tarefa}/{repo}' },
  overrides: EMPTY_OVERRIDES,
  extraRepos: [],
  imported: false,
  notes: {},
  sessionLinks: {},
}

// Cada ajuste é uma função pura da configuração: o TaskService lê, aplica e grava.
type Config = WorkspaceTaskConfig

export function setGrouping(c: Config, grouping: TaskGrouping): Config {
  return { ...c, grouping }
}

// Nome vazio volta ao nome descoberto.
export function renameTask(c: Config, taskId: string, name: string): Config {
  const trimmed = name.trim()
  const others = Object.entries(c.overrides.names).filter(([id]) => id !== taskId)
  const names = Object.fromEntries(trimmed ? [...others, [taskId, trimmed]] : others)
  const manual = c.overrides.manual.map((m) =>
    m.id === taskId && trimmed ? { ...m, name: trimmed } : m,
  )
  return { ...c, overrides: { ...c.overrides, names, manual } }
}

// Coloca a worktree na tarefa `taskId`; `newManual` cria antes uma tarefa manual com esse id.
export function assignWorktree(
  c: Config,
  worktree: string,
  taskId: string,
  newManual?: { id: string; name: string },
): Config {
  const manual = newManual ? [...c.overrides.manual, newManual] : c.overrides.manual
  return {
    ...c,
    overrides: { ...c.overrides, manual, moves: { ...c.overrides.moves, [worktree]: taskId } },
  }
}

export function ignoreWorktree(c: Config, worktree: string): Config {
  return {
    ...c,
    overrides: { ...c.overrides, ignored: [...new Set([...c.overrides.ignored, worktree])] },
  }
}

// Conclui a descoberta: as tarefas desmarcadas ficam escondidas da Central.
export function importTasks(c: Config, hidden: string[]): Config {
  return { ...c, imported: true, overrides: { ...c.overrides, hidden: [...new Set(hidden)] } }
}

export function setHidden(c: Config, taskId: string, hidden: boolean): Config {
  const set = new Set(c.overrides.hidden)
  if (hidden) set.add(taskId)
  else set.delete(taskId)
  return { ...c, overrides: { ...c.overrides, hidden: [...set] } }
}

export function setNotes(c: Config, taskId: string, notes: string): Config {
  return { ...c, notes: { ...c.notes, [taskId]: notes } }
}

// `taskId` null desfaz a ligação manual da sessão.
export function linkSession(c: Config, sessionId: string, taskId: string | null): Config {
  const others = Object.entries(c.sessionLinks).filter(([id]) => id !== sessionId)
  return {
    ...c,
    sessionLinks: Object.fromEntries(taskId ? [...others, [sessionId, taskId]] : others),
  }
}

export function addExtraRepo(c: Config, repo: string): Config {
  return { ...c, extraRepos: [...new Set([...c.extraRepos, repo])] }
}

// Tira um repo do workspace: o de outra pasta sai da lista; o achado na varredura fica ignorado
// (senão a próxima varredura o traria de volta).
export function removeRepo(c: Config, repo: string): Config {
  return c.extraRepos.includes(repo)
    ? { ...c, extraRepos: c.extraRepos.filter((r) => r !== repo) }
    : { ...c, ignoredRepos: [...new Set([...(c.ignoredRepos ?? []), repo])] }
}

export function restoreRepo(c: Config, repo: string): Config {
  return { ...c, ignoredRepos: (c.ignoredRepos ?? []).filter((r) => r !== repo) }
}

// Desfaz uma tarefa montada à mão: as worktrees dela voltam para a heurística (ou ficam soltas).
export function removeManualTask(c: Config, taskId: string): Config {
  if (!c.overrides.manual.some((m) => m.id === taskId)) {
    throw new AppException('INVALID_ARGS', t('error.onlyManualTasks'))
  }
  const without = <T>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([id]) => id !== taskId))
  const notPointingTo = (rec: Record<string, string>) =>
    Object.fromEntries(Object.entries(rec).filter(([, target]) => target !== taskId))
  return {
    ...c,
    overrides: {
      ...c.overrides,
      manual: c.overrides.manual.filter((m) => m.id !== taskId),
      moves: notPointingTo(c.overrides.moves),
      names: without(c.overrides.names),
      hidden: c.overrides.hidden.filter((id) => id !== taskId),
    },
    notes: without(c.notes),
    sessionLinks: notPointingTo(c.sessionLinks),
  }
}
