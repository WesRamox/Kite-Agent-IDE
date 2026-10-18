import type { GitChangeKind } from '@shared/types'
import { t } from './i18n'

export const KIND_LETTER: Record<GitChangeKind, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typechange: 'T',
  untracked: 'U',
  conflicted: '!',
}

export function kindLabel(kind: GitChangeKind): string {
  return t(`git.kind.${kind}`)
}

export const KIND_COLOR: Record<GitChangeKind, string> = {
  modified: 'text-warning',
  added: 'text-success',
  deleted: 'text-danger',
  renamed: 'text-info',
  copied: 'text-info',
  typechange: 'text-warning',
  untracked: 'text-success',
  conflicted: 'text-danger',
}

// O tipo mais relevante para exibir na árvore (o que está no disco tem prioridade).
export function displayKind(change: {
  staged: GitChangeKind | null
  unstaged: GitChangeKind | null
}): GitChangeKind | null {
  return change.unstaged ?? change.staged
}
