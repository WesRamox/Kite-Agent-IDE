import { Bot, Files, GitBranch, GitPullRequest, type LucideIcon } from 'lucide-react'
import type { SidebarView } from '../stores/layout.store'

export interface ViewDef {
  id: SidebarView
  label: string
  icon: LucideIcon
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'explorer', label: 'Explorer', icon: Files },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'github', label: 'GitHub', icon: GitPullRequest },
  { id: 'agents', label: 'Agents', icon: Bot },
]
