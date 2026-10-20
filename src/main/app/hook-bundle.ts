import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { Logger } from '../lib/logger'

// Executável e scripts que rodam fora do app: o kite-hook (que o kite-hook.sh chama) e o kite-mcp
// (ferramentas do quadro para os agentes). No app empacotado, os scripts (fora do asar, via
// asarUnpack) são copiados para a pasta de perfil: o AppImage é montado num caminho novo a cada
// execução, e os hooks precisam funcionar com o Kite fechado. Nele, o executável é o próprio
// arquivo .AppImage (variável APPIMAGE), que tem caminho estável.
export function hookBundle(log: Logger): { exec: string; script: string; mcp: string } {
  const unpacked = (name: string) =>
    join(__dirname, name).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
  const built = unpacked('kite-hook.js')
  const builtMcp = unpacked('kite-mcp.js')
  if (!app.isPackaged) return { exec: process.execPath, script: built, mcp: builtMcp }
  const dir = join(app.getPath('userData'), 'hook')
  try {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    cpSync(built, join(dir, 'kite-hook.js'))
    cpSync(builtMcp, join(dir, 'kite-mcp.js'))
    cpSync(join(dirname(built), 'chunks'), join(dir, 'chunks'), { recursive: true })
    return {
      exec: process.env['APPIMAGE'] ?? process.execPath,
      script: join(dir, 'kite-hook.js'),
      mcp: join(dir, 'kite-mcp.js'),
    }
  } catch (err) {
    log.warn('não foi possível copiar o kite-hook', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { exec: process.execPath, script: built, mcp: builtMcp }
  }
}
