import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'node',
    // pnpm test:coverage. A cola com o Electron (bootstrap, janela, menu, registro no ipcMain,
    // kite-hook) fica de fora: é coberta pelo e2e. As metas ficam um pouco abaixo do medido e só
    // sobem (docs/refactor-plan.md, R5).
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts', 'src/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/shared/i18n/messages/**',
        'src/renderer/src/test/**',
        'src/main/index.ts',
        'src/main/app/**',
        'src/main/menu.ts',
        'src/main/ipc/register.ts',
        'src/main/hook/**',
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      thresholds: {
        'src/main/services/**': { lines: 90, branches: 70 },
        'src/main/lib/**': { lines: 90, branches: 80 },
        'src/renderer/src/**': { lines: 15 },
      },
    },
  },
})
