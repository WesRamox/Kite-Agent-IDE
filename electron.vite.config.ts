import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { parseEnv } from './src/main/lib/env-file'

const shared = { '@shared': resolve(__dirname, 'src/shared') }

// Client ID do OAuth App do GitHub embutido no build (não é segredo: o Device Flow não usa client
// secret). Vem de KITE_GITHUB_CLIENT_ID (no CI, uma variável do repositório) ou, num build local,
// do GITHUB_CLIENT_ID do .env. Sem nenhum, o app pede a configuração como antes.
function builtInClientId(): string {
  const fromEnv = process.env['KITE_GITHUB_CLIENT_ID']
  if (fromEnv) return fromEnv
  try {
    return parseEnv(readFileSync(resolve(__dirname, '.env'), 'utf8'))['GITHUB_CLIENT_ID'] ?? ''
  } catch {
    return ''
  }
}

export default defineConfig({
  main: {
    resolve: { alias: shared },
    define: { __KITE_GITHUB_CLIENT_ID__: JSON.stringify(builtInClientId()) },
    // kite-hook: script executado pelos hooks do Claude Code (Fase 6), fora do processo do app.
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'kite-hook': resolve(__dirname, 'src/main/hook/kite-hook.ts'),
          // kite-mcp: ferramentas do quadro para os agentes (o Claude Code abre como servidor MCP).
          'kite-mcp': resolve(__dirname, 'src/main/hook/kite-mcp.ts'),
        },
      },
    },
  },
  preload: {
    resolve: { alias: shared },
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [react(), tailwindcss()],
  },
})
