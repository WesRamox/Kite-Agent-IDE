// Logger único do processo main. Nunca registre conteúdo de arquivos ou tokens.

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
  child(scope: string): Logger
}

export type LogSink = (level: LogLevel, line: string) => void

// Destinos extras (o arquivo de log na pasta de perfil), ligados depois que ela é conhecida.
const extraSinks: LogSink[] = []

const consoleSink: LogSink = (level, line) => {
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  for (const sink of extraSinks) sink(level, line)
}

// Grava também num arquivo (ex.: userData/logs/main.log). Passou de 1 MB, o anterior vira
// main.log.1: o log serve para diagnosticar problemas, não para guardar histórico.
export function addLogFile(file: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    if (existsSync(file) && statSync(file).size > 1_000_000) renameSync(file, `${file}.1`)
  } catch {
    return
  }
  extraSinks.push((_level, line) => {
    try {
      appendFileSync(file, `${line}\n`)
    } catch {
      // disco cheio ou sem permissão: segue só no console
    }
  })
}

function parseLevel(value: string | undefined): LogLevel | undefined {
  return value && value in LEVEL_ORDER ? (value as LogLevel) : undefined
}

export function createLogger(
  scope: string,
  minLevel: LogLevel = parseLevel(process.env['LOG_LEVEL']) ?? 'info',
  sink: LogSink = consoleSink,
): Logger {
  const write = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return
    const suffix = meta ? ` ${JSON.stringify(meta)}` : ''
    sink(level, `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${message}${suffix}`)
  }
  return {
    debug: (m, meta) => write('debug', m, meta),
    info: (m, meta) => write('info', m, meta),
    warn: (m, meta) => write('warn', m, meta),
    error: (m, meta) => write('error', m, meta),
    child: (child) => createLogger(`${scope}:${child}`, minLevel, sink),
  }
}

export const logger = createLogger('main')
