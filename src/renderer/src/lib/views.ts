import { Files, GitBranch, GitPullRequest, Inbox, type LucideIcon } from 'lucide-react'
import type { SidebarView } from '../stores/layout.store'

export interface ViewDef {
  id: SidebarView
  label: string
  icon: LucideIcon
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'attention', label: 'Central de atenção', icon: Inbox },
  { id: 'explorer', label: 'Explorer', icon: Files },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'github', label: 'GitHub', icon: GitPullRequest },
]
