import { Files, GitBranch, GitPullRequest, Inbox, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@shared/i18n'
import type { SidebarView } from '../stores/layout.store'

export interface ViewDef {
  id: SidebarView
  label: MessageKey
  icon: LucideIcon
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'attention', label: 'view.attention', icon: Inbox },
  { id: 'explorer', label: 'view.explorer', icon: Files },
  { id: 'git', label: 'view.git', icon: GitBranch },
  { id: 'github', label: 'view.github', icon: GitPullRequest },
]
