import { useEffect } from 'react'
import { create } from 'zustand'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useActiveTask, useTasksStore } from '../tasks/tasks.store'
import { useGitStore } from './git.store'

// Repositório que os painéis Git e GitHub mostram. Numa tarefa aberta, uma das worktrees dela;
// num workspace com vários repos (a pasta aberta não é um repositório), um desses repos; senão,
// a própria pasta aberta. A escolha do usuário fica guardada por contexto (tarefa ou workspace).

export interface ScmCandidate {
  path: string
  name: string
  // Branch da worktree (na tarefa) para diferenciar.
  detail: string | null
}

interface ScmState {
  picked: Record<string, string>
  pick: (context: string, path: string) => void
}

export const useScmStore = create<ScmState>((set) => ({
  picked: {},
  pick: (context, path) => set((s) => ({ picked: { ...s.picked, [context]: path } })),
}))

const NO_CANDIDATES: ScmCandidate[] = []

export function useScmCandidates(): { context: string; candidates: ScmCandidate[] } {
  const task = useActiveTask()
  const repos = useTasksStore((s) => s.workspace?.repos)
  if (task) {
    return {
      context: `task:${task.id}`,
      candidates: task.worktrees.map((w) => ({ path: w.path, name: w.repoName, detail: w.branch })),
    }
  }
  return {
    context: 'workspace',
    candidates: repos?.map((r) => ({ path: r.path, name: r.name, detail: null })) ?? NO_CANDIDATES,
  }
}

// Caminho efetivo: a escolha guardada, se ainda existe; senão o primeiro candidato; sem
// candidatos, a pasta aberta.
export function useScmTarget(): string | null {
  const root = useWorkspaceStore((s) => s.root)
  const { context, candidates } = useScmCandidates()
  const picked = useScmStore((s) => s.picked[context])
  if (!root) return null
  if (candidates.length === 0) return root
  return candidates.find((c) => c.path === picked)?.path ?? candidates[0]?.path ?? root
}

// Libera o repositório escolhido no main (fora da pasta aberta ele não é uma raiz) e observa o
// .git dele. Devolve false se não deu para liberar.
async function prepare(target: string): Promise<boolean> {
  const root = useWorkspaceStore.getState().root
  if (root && target !== root) {
    const res = await window.api.task.openRepo(root, target)
    if (!res.ok) return false
  }
  await window.api.git.watch(target)
  return true
}

// Troca o repositório do git store quando a tarefa, a escolha ou a pasta mudam.
export function useScmTargetSync(refresh: () => Promise<void>): void {
  const target = useScmTarget()
  useEffect(() => {
    useGitStore.getState().reset(target)
    if (!target) return
    let alive = true
    void prepare(target).then((ok) => {
      if (!alive || useGitStore.getState().root !== target) return
      if (ok) void refresh()
      else useGitStore.getState().set({ status: { isRepo: false } })
    })
    return () => {
      alive = false
    }
  }, [target, refresh])
}
