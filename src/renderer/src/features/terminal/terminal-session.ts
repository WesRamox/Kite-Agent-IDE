import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import type { PtyExitEvent } from '@shared/types'
import { isMac, isWindows } from '../../lib/platform'
import { routePty } from './pty-router'
import { TERMINAL_THEME } from './terminal-theme'

export const SCROLLBACK_LINES = 5000
const SAVED_LINES = 1000

export interface SessionOptions {
  cwd: string
  restore?: string
  onExit: (event: PtyExitEvent) => void
  onOpenSearch: () => void
}

// Um terminal: instância do xterm + addons + o PTY no main.
export class TerminalSession {
  readonly term: Terminal
  private readonly fitAddon = new FitAddon()
  private readonly search = new SearchAddon()
  private readonly serializer = new SerializeAddon()
  private webgl: WebglAddon | null = null
  private ptyId: string | null = null
  private unroute: (() => void) | null = null
  private opened = false
  private disposed = false
  private lastSize = { cols: 0, rows: 0 }

  constructor(private readonly options: SessionOptions) {
    this.term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      fontSize: 13,
      scrollback: SCROLLBACK_LINES,
      cursorBlink: true,
      allowProposedApi: true,
      macOptionIsMeta: true,
    })
    this.term.loadAddon(this.fitAddon)
    this.term.loadAddon(this.search)
    this.term.loadAddon(this.serializer)
    // window.open é interceptado no main e abre o link no navegador do sistema.
    this.term.loadAddon(new WebLinksAddon((_event, uri) => window.open(uri, '_blank')))
    this.term.attachCustomKeyEventHandler((e) => this.handleKey(e))
  }

  // Abre o xterm no elemento e inicia o PTY (só na primeira vez).
  async attach(el: HTMLElement): Promise<void> {
    if (this.opened) return
    this.opened = true
    this.term.open(el)
    this.loadRenderer()
    this.fit()
    if (this.options.restore) {
      this.term.write(this.options.restore)
      this.term.write('\r\n\x1b[2m── sessão restaurada ──\x1b[0m\r\n')
    }
    const res = await window.api.pty.create({
      cwd: this.options.cwd,
      cols: Math.max(this.term.cols, 2),
      rows: Math.max(this.term.rows, 1),
    })
    if (!res.ok) {
      this.term.write(
        `\r\n\x1b[31mNão foi possível iniciar o terminal: ${res.error.message}\x1b[0m\r\n`,
      )
      return
    }
    if (this.disposed) {
      void window.api.pty.kill(res.data.id)
      return
    }
    const id = res.data.id
    this.ptyId = id
    this.unroute = routePty(id, {
      data: (data) => this.term.write(data),
      exit: (event) => {
        this.ptyId = null
        this.options.onExit(event)
      },
    })
    this.term.onData((data) => void window.api.pty.write(id, data))
    this.term.onBinary((data) => void window.api.pty.write(id, data))
    this.term.onResize(({ cols, rows }) => this.syncSize(cols, rows))
    this.syncSize(this.term.cols, this.term.rows)
  }

  // Ajusta ao tamanho do contêiner (ignora quando o painel está oculto).
  fit(): void {
    const el = this.term.element
    if (!el || this.disposed || el.clientWidth === 0 || el.clientHeight === 0) return
    try {
      this.fitAddon.fit()
    } catch {
      // contêiner sem dimensões ainda
    }
  }

  focus(): void {
    this.term.focus()
  }

  findNext(query: string): boolean {
    return this.search.findNext(query)
  }

  findPrevious(query: string): boolean {
    return this.search.findPrevious(query)
  }

  clearSearch(): void {
    this.search.clearDecorations()
    this.term.clearSelection()
  }

  serialize(): string {
    return this.serializer.serialize({ scrollback: SAVED_LINES })
  }

  write(text: string): void {
    this.term.write(text)
  }

  isRunning(): boolean {
    return this.ptyId !== null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unroute?.()
    if (this.ptyId) void window.api.pty.kill(this.ptyId)
    this.ptyId = null
    this.webgl?.dispose()
    this.term.dispose()
  }

  private syncSize(cols: number, rows: number): void {
    if (!this.ptyId || (cols === this.lastSize.cols && rows === this.lastSize.rows)) return
    this.lastSize = { cols, rows }
    void window.api.pty.resize(this.ptyId, cols, rows)
  }

  // WebGL quando possível; se falhar ou perder o contexto, volta ao renderer DOM do xterm.
  private loadRenderer(): void {
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => {
        webgl.dispose()
        this.webgl = null
      })
      this.term.loadAddon(webgl)
      this.webgl = webgl
    } catch {
      this.webgl = null
    }
  }

  private handleKey(e: KeyboardEvent): boolean {
    if (e.type !== 'keydown') return true
    const key = e.key.toLowerCase()
    const mod = isMac ? e.metaKey : e.ctrlKey

    const copyCombo = isMac
      ? e.metaKey && key === 'c'
      : (e.ctrlKey && e.shiftKey && key === 'c') ||
        // Windows: Ctrl+C copia se houver seleção (como no Windows Terminal).
        (isWindows && e.ctrlKey && !e.shiftKey && key === 'c' && this.term.hasSelection())
    if (copyCombo) {
      const text = this.term.getSelection()
      if (text) void window.api.clipboard.writeText(text)
      return false
    }

    const pasteCombo = isMac
      ? e.metaKey && key === 'v'
      : (e.ctrlKey && e.shiftKey && key === 'v') || (isWindows && e.ctrlKey && key === 'v')
    if (pasteCombo) {
      e.preventDefault()
      void window.api.clipboard.readText().then((res) => {
        if (res.ok && res.data) this.term.paste(res.data)
      })
      return false
    }

    if (mod && !e.shiftKey && !e.altKey && key === 'f') {
      e.preventDefault()
      this.options.onOpenSearch()
      return false
    }
    return true
  }
}
