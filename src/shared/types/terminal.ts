// Terminais (PTY) e sessões salvas.

export interface PtyCreateOptions {
  cwd: string
  shell?: string
  cols: number
  rows: number
}

export interface PtyDataEvent {
  id: string
  data: string
  // Total de caracteres emitidos por este PTY até o fim deste trecho (para reconectar a um
  // terminal sem duplicar saída).
  end: number
}

export interface PtyExitEvent {
  id: string
  exitCode: number
}

// Terminal salvo ao fechar o app/workspace, restaurado ao reabrir.
export interface TerminalSession {
  title: string
  scrollback: string
}
