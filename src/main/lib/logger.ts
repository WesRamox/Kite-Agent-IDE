// Logger único do processo main. Nunca registre conteúdo de arquivos ou tokens.

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

const consoleSink: LogSink = (level, line) => {
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
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
