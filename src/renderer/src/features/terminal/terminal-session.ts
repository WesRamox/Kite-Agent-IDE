import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import type { PtyDataEvent, PtyExitEvent } from '@shared/types'
import { isMac, isWindows } from '../../lib/platform'
import { CODE_FONT, codeFontReady } from '../../lib/code-font'
import { routePty, unseenPart } from './pty-router'
import { useThemeStore } from '../../stores/theme.store'
import { terminalTheme } from './terminal-theme'
import { useSettingsStore } from '../../stores/settings.store'
import { t } from '../../lib/i18n'

export const SCROLLBACK_LINES = 5000
const SAVED_LINES = 1000

export interface SessionOptions {
  // Terminal próprio (cria um shell em `cwd`) ou visualização do PTY de um agente.
  // `input`: texto digitado no shell assim que ele abre (ex.: `claude --resume <id>`).
  source:
    | { kind: 'shell'; cwd: string; restore?: string; input?: string }
    | { kind: 'agent'; taskId: string }
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
  // Agentes: o PTY pertence ao main e continua vivo quando o terminal fecha.
  private ownsPty = true
  private fontSize = useSettingsStore.getState().settings.terminalFontSize

  constructor(private readonly options: SessionOptions) {
    this.term = new Terminal({
      theme: terminalTheme(useThemeStore.getState().theme),
      fontFamily: CODE_FONT,
      fontSize: this.fontSize,
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

  // Tamanho da fonte trocado nas configurações. Só é aplicado com o terminal visível (no fit):
  // escondido, o xterm não consegue medir a fonte nova e ficaria com as células antigas.
  setFontSize(size: number): void {
    this.fontSize = size
    if (this.opened) this.fit()
  }

  // Abre o xterm no elemento e inicia (ou conecta) o PTY, só na primeira vez.
  async attach(el: HTMLElement): Promise<void> {
    if (this.opened) return
    this.opened = true
    await codeFontReady()
    if (this.disposed) return
    this.term.open(el)
    this.loadRenderer()
    this.fit()
    const source = this.options.source
    if (source.kind === 'agent') await this.attachAgent(source.taskId)
    else await this.startShell(source.cwd, source.restore, source.input)
  }

  // PTY ligado a este terminal (shell próprio ou agente).
  get pty(): string | null {
    return this.ptyId
  }

  private async startShell(cwd: string, restore?: string, input?: string): Promise<void> {
    if (restore) {
      this.term.write(restore)
      this.term.write(`\r\n\x1b[2m${t('terminal.restored')}\x1b[0m\r\n`)
    }
    const res = await window.api.pty.create({
      cwd,
      cols: Math.max(this.term.cols, 2),
      rows: Math.max(this.term.rows, 1),
    })
    if (!res.ok) {
      this.term.write(
        `\r\n\x1b[31m${t('terminal.startError', { reason: res.error.message })}\x1b[0m\r\n`,
      )
      return
    }
    if (this.disposed) {
      void window.api.pty.kill(res.data.id)
      return
    }
    this.connect(res.data.id, [])
    if (input) void window.api.pty.write(res.data.id, `${input}\r`)
  }

  // Conecta a um agente que roda no main: escreve o histórico e segue a saída ao vivo, sem
  // repetir trechos (cada evento traz o offset `end`).
  private async attachAgent(taskId: string): Promise<void> {
    const queued: PtyDataEvent[] = []
    let shown = -1
    let unroute: (() => void) | null = null
    const first = await window.api.agent.attach(taskId)
    if (!first.ok) {
      this.term.write(`\r\n\x1b[31m${first.error.message}\x1b[0m\r\n`)
      return
    }
    const ptyId = first.data.ptyId
    if (ptyId) {
      // Registra antes de pedir o histórico de novo, para não perder nada no meio.
      unroute = routePty(ptyId, {
        data: (event) => {
          if (shown < 0) queued.push(event)
          else {
            const part = unseenPart(event, shown)
            shown = Math.max(shown, event.end)
            if (part) this.term.write(part)
          }
        },
        exit: (event) => {
          this.ptyId = null
          this.options.onExit(event)
        },
      })
    }
    const snap = ptyId ? await window.api.agent.attach(taskId) : first
    if (this.disposed) {
      unroute?.()
      return
    }
    if (!snap.ok) return
    this.term.write(snap.data.history)
    shown = snap.data.end
    for (const event of queued) {
      const part = unseenPart(event, shown)
      shown = Math.max(shown, event.end)
      if (part) this.term.write(part)
    }
    if (!ptyId || !snap.data.ptyId) {
      this.term.write(`\r\n\x1b[2m${t('terminal.agentEnded')}\x1b[0m\r\n`)
      unroute?.()
      return
    }
    this.unroute = unroute
    this.ownsPty = false
    this.wireInput(ptyId)
  }

  private connect(id: string, early: PtyDataEvent[]): void {
    this.unroute = routePty(id, {
      data: (event) => this.term.write(event.data),
      exit: (event) => {
        this.ptyId = null
        this.options.onExit(event)
      },
    })
    for (const event of early) this.term.write(event.data)
    this.wireInput(id)
  }

  private wireInput(id: string): void {
    this.ptyId = id
    this.term.onData((data) => void window.api.pty.write(id, data))
    this.term.onBinary((data) => void window.api.pty.write(id, data))
    this.term.onResize(({ cols, rows }) => this.syncSize(cols, rows))
    this.syncSize(this.term.cols, this.term.rows)
  }

  // Ajusta ao tamanho do contêiner (ignora quando o painel está oculto).
  fit(): void {
    const el = this.term.element
    if (!el || this.disposed || el.clientWidth === 0 || el.clientHeight === 0) return
    if (this.term.options.fontSize !== this.fontSize) this.term.options.fontSize = this.fontSize
    try {
      this.fitAddon.fit()
    } catch {
      // contêiner sem dimensões ainda
    }
  }

  setTheme(theme: ReturnType<typeof terminalTheme>): void {
    this.term.options.theme = theme
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
    if (this.ptyId && this.ownsPty) void window.api.pty.kill(this.ptyId)
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
