import { chmod, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { HooksStatus } from '@shared/types'
import {
  addKiteHooks,
  hasKiteHooks,
  HOOK_TARGETS,
  hookCommand,
  kiteSnippet,
  removeKiteHooks,
  type HookTarget,
  type Json,
} from '../lib/claude-settings'
import { AppException } from '../lib/errors'
import type { Logger } from '../lib/logger'

export interface HooksServiceDeps {
  // CLI e o arquivo de configuração dele (ex.: ~/.claude/settings.json).
  target?: HookTarget
  settingsPath: string
  // Script gerado pelo Kite que o hook chama (userData/kite-hook.sh).
  wrapperPath: string
  wrapperContent: string
  home: string
  log: Logger
}

let tmpCounter = 0

// Instala e remove os hooks do Kite num CLI de agente, sem mexer no resto da configuração.
export class HooksService {
  private readonly target: HookTarget

  constructor(private readonly deps: HooksServiceDeps) {
    this.target = deps.target ?? HOOK_TARGETS.claude
  }

  // Recria o script a cada abertura: os caminhos do Electron mudam entre versões e em dev.
  async ensureWrapper(): Promise<void> {
    const { wrapperPath, wrapperContent } = this.deps
    const current = await readFile(wrapperPath, 'utf8').catch(() => null)
    if (current !== wrapperContent) {
      await mkdir(path.dirname(wrapperPath), { recursive: true })
      await writeFile(wrapperPath, wrapperContent, { mode: 0o700 })
    }
    await chmod(wrapperPath, 0o700)
  }

  async status(): Promise<HooksStatus> {
    const base = {
      cli: this.target.cli,
      settingsPath: this.display(this.deps.settingsPath),
      // Só o nome do script, como no desenho: o caminho completo quebraria as linhas.
      snippet: kiteSnippet(
        `${path.basename(this.deps.wrapperPath)}${this.target.cli === 'claude' ? '' : ` ${this.target.cli}`}`,
        this.target.events,
      ),
    }
    try {
      const settings = await this.read()
      return { ...base, installed: hasKiteHooks(settings, this.target.events), error: null }
    } catch (err) {
      return { ...base, installed: false, error: (err as Error).message }
    }
  }

  async install(): Promise<HooksStatus> {
    await this.ensureWrapper()
    const settings = await this.readOrThrow()
    await this.backup()
    const command = hookCommand(this.deps.wrapperPath, this.target.cli)
    await this.write(addKiteHooks(settings, command, this.target.events, this.target.timeout))
    this.deps.log.info('hooks instalados', { cli: this.target.cli })
    return this.status()
  }

  async uninstall(): Promise<HooksStatus> {
    const settings = await this.readOrThrow()
    await this.write(removeKiteHooks(settings))
    this.deps.log.info('hooks removidos', { cli: this.target.cli })
    return this.status()
  }

  private display(p: string): string {
    const { home } = this.deps
    return p === home || p.startsWith(home + path.sep) ? `~${p.slice(home.length)}` : p
  }

  // settings.json ausente vale como vazio; JSON inválido é erro (nunca sobrescrevemos).
  private async read(): Promise<Json> {
    let raw: string
    try {
      raw = await readFile(this.deps.settingsPath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw err
    }
    if (raw.trim() === '') return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('o settings.json não contém um objeto JSON')
    }
    return parsed as Json
  }

  private async readOrThrow(): Promise<Json> {
    try {
      return await this.read()
    } catch (err) {
      throw new AppException(
        'INVALID_SETTINGS',
        `Não foi possível ler ${this.display(this.deps.settingsPath)}: ${(err as Error).message}`,
      )
    }
  }

  // Cópia do original, feita só uma vez (antes da primeira alteração do Kite).
  private async backup(): Promise<void> {
    const target = `${this.deps.settingsPath}.kite-backup`
    try {
      await copyFile(this.deps.settingsPath, target, 1 /* COPYFILE_EXCL */)
    } catch {
      // Já existe um backup, ou não há settings.json para copiar.
    }
  }

  private async write(settings: Json): Promise<void> {
    const file = this.deps.settingsPath
    await mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`
    try {
      await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
      await rename(tmp, file)
    } catch (err) {
      throw new AppException(
        'INTERNAL',
        `Não foi possível gravar ${this.display(file)}: ${(err as Error).message}`,
      )
    }
  }
}
