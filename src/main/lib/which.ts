import { accessSync, constants, readFileSync } from 'node:fs'
import path from 'node:path'

// Procura um executável no PATH (sem depender de `which`/`where`).
export function which(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const isWin = process.platform === 'win32'
  const dirs = (env['PATH'] ?? env['Path'] ?? '').split(path.delimiter).filter(Boolean)
  const exts = isWin && !path.extname(name) ? (env['PATHEXT'] ?? '.EXE;.CMD;.BAT').split(';') : ['']
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext)
      try {
        accessSync(candidate, isWin ? constants.F_OK : constants.X_OK)
        return candidate
      } catch {
        // continua procurando
      }
    }
  }
  return null
}

// Shells que podem ser pedidos explicitamente pelo renderer.
export function listShells(): string[] {
  if (process.platform === 'win32') {
    return ['pwsh.exe', 'powershell.exe', 'cmd.exe']
      .map((s) => which(s))
      .filter((s): s is string => s !== null)
  }
  try {
    return readFileSync('/etc/shells', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('/'))
  } catch {
    return []
  }
}
