import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

// Arquivos do app no perfil (não copia caches do Chromium).
const OWN_FILES = [
  'workspace.json',
  'agents.json',
  'settings.json',
  'terminal-sessions',
  'github-token.bin',
]

// O app se chamava "AiController" (perfil em <appData>/ai-controller). Na primeira execução como
// Kite, copia os dados do perfil antigo para não perder recentes, tarefas e terminais.
export function migrateLegacyProfile(
  appData: string,
  userData: string,
  legacyName = 'ai-controller',
): string[] {
  const legacy = path.join(appData, legacyName)
  if (legacy === userData || !existsSync(legacy)) return []
  if (OWN_FILES.some((f) => existsSync(path.join(userData, f)))) return [] // já migrado ou em uso
  const copied: string[] = []
  for (const name of OWN_FILES) {
    const from = path.join(legacy, name)
    if (!existsSync(from)) continue
    cpSync(from, path.join(userData, name), { recursive: true, errorOnExist: false })
    copied.push(name)
  }
  return copied
}
