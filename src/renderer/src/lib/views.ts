import { BellRing, FolderTree, GitCompare, GitPullRequest, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@shared/i18n'
import type { SidebarView } from '../stores/layout.store'

export interface ViewDef {
  id: SidebarView
  label: MessageKey
  icon: LucideIcon
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'attention', label: 'view.attention', icon: BellRing },
  { id: 'explorer', label: 'view.explorer', icon: FolderTree },
  { id: 'git', label: 'view.git', icon: GitCompare },
  { id: 'github', label: 'view.github', icon: GitPullRequest },
]
