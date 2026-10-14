import { useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useGitStore } from './git.store'

const DEBOUNCE_MS = 250

let running: Promise<void> | null = null
let again = false

// Busca status, branches e worktrees. Chamadas durante uma busca em andamento são agrupadas
// numa única nova busca ao final.
export async function refreshGit(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const root = useGitStore.getState().root
      if (!root) return
      const status = await window.api.git.status(root)
      if (useGitStore.getState().root !== root) return
      if (!status.ok) {
        useGitStore.getState().set({ status: { isRepo: false } })
        return
      }
      if (!status.data.isRepo) {
        useGitStore.getState().set({ status: status.data, branches: [], worktrees: [] })
        return
      }
      const [branches, worktrees] = await Promise.all([
        window.api.git.branches(root),
        window.api.git.worktreeList(root),
      ])
      if (useGitStore.getState().root !== root) return
      useGitStore.getState().set({
        status: status.data,
        branches: branches.ok ? branches.data : [],
        worktrees: worktrees.ok ? worktrees.data : [],
      })
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

let timer: ReturnType<typeof setTimeout> | undefined
export function scheduleGitRefresh(): void {
  clearTimeout(timer)
  timer = setTimeout(() => void refreshGit(), DEBOUNCE_MS)
}

// Mantém o estado do git em dia: troca de pasta, mudanças no .git (commits/checkout feitos no
// terminal), mudanças nos arquivos e foco da janela.
export function useGitSync(): void {
  const root = useWorkspaceStore((s) => s.root)

  useEffect(() => {
    useGitStore.getState().reset(root)
    if (root) void refreshGit()
  }, [root])

  useEffect(() => {
    const offGit = window.api.git.onChanged(({ root: changed }) => {
      if (changed === useGitStore.getState().root) scheduleGitRefresh()
    })
    const offFs = window.api.fs.onChanged(({ root: changed }) => {
      if (changed === useGitStore.getState().root) scheduleGitRefresh()
    })
    const onFocus = () => scheduleGitRefresh()
    window.addEventListener('focus', onFocus)
    return () => {
      offGit()
      offFs()
      window.removeEventListener('focus', onFocus)
    }
  }, [])
}
