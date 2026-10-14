import type { GitChangeKind } from '@shared/types'

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

export const KIND_LABEL: Record<GitChangeKind, string> = {
  modified: 'Modificado',
  added: 'Adicionado',
  deleted: 'Removido',
  renamed: 'Renomeado',
  copied: 'Copiado',
  typechange: 'Tipo alterado',
  untracked: 'Não rastreado',
  conflicted: 'Conflito',
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
