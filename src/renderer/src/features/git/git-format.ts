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
  modified: 'text-amber-300',
  added: 'text-emerald-300',
  deleted: 'text-red-400',
  renamed: 'text-sky-300',
  copied: 'text-sky-300',
  typechange: 'text-amber-300',
  untracked: 'text-emerald-300',
  conflicted: 'text-red-400',
}

// O tipo mais relevante para exibir na árvore (o que está no disco tem prioridade).
export function displayKind(change: {
  staged: GitChangeKind | null
  unstaged: GitChangeKind | null
}): GitChangeKind | null {
  return change.unstaged ?? change.staged
}
