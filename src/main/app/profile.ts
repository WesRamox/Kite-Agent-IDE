import { join } from 'node:path'
import { app } from 'electron'
import { loadEnvFiles } from '../lib/env-file'
import { migrateLegacyProfile } from '../lib/legacy-profile'
import { addLogFile, type Logger } from '../lib/logger'

// Antes do app ficar pronto: nome, pasta de perfil, arquivo de log e .env.
export function prepareProfile(log: Logger): void {
  // O nome do app (productName) é Kite. KITE_USER_DATA_DIR isola o perfil nos testes e2e.
  app.setName('Kite')
  const userDataOverride = process.env['KITE_USER_DATA_DIR']
  if (userDataOverride) app.setPath('userData', userDataOverride)
  else {
    const copied = migrateLegacyProfile(app.getPath('appData'), app.getPath('userData'))
    if (copied.length > 0) log.info('perfil do AiController migrado', { files: copied })
  }
  addLogFile(join(app.getPath('userData'), 'logs', 'main.log'))
  log.info('Kite iniciando', {
    version: app.getVersion(),
    platform: process.platform,
    session: process.env['XDG_SESSION_TYPE'] ?? null,
  })

  // .env com a configuração do app: o da pasta do projeto em `pnpm dev` e o da pasta de perfil
  // (vale também no app empacotado). Loga só os nomes das chaves, nunca os valores.
  const envFiles = [join(app.getPath('userData'), '.env')]
  if (!app.isPackaged) envFiles.unshift(join(app.getAppPath(), '.env'))
  const env = loadEnvFiles(envFiles, process.env)
  if (env.keys.length > 0) log.info('configuração lida do .env', env)
}
