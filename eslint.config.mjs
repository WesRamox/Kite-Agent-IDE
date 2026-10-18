import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'release/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // `void` é o tipo de resultado dos canais IPC sem retorno.
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', '*.config.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Logs só pelo logger, que é quem escreve no console.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    ignores: ['src/main/lib/logger.ts', '**/*.test.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // Serviços e lib testáveis sem Electron: o que for do Electron entra por injeção.
    files: ['src/main/services/**/*.ts', 'src/main/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: 'Injete a dependência pelo construtor.' }],
          patterns: [
            { group: ['**/ipc/*', '**/app/*'], message: 'services/lib não dependem de ipc/app.' },
          ],
        },
      ],
    },
  },
  {
    // shared roda nos três processos: nada de Node, Electron, DOM ou dos outros lados.
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['electron'],
          patterns: [
            { group: ['node:*'], message: 'shared não usa APIs do Node.' },
            { group: ['**/main/**', '**/preload/**', '**/renderer/**', '@renderer/*'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['electron'],
          patterns: [
            {
              group: ['node:*'],
              message: 'O renderer roda em sandbox; peça ao main via window.api.',
            },
            {
              group: ['**/main/**', '**/preload/**'],
              message: 'Use window.api e tipos de @shared.',
            },
          ],
        },
      ],
    },
  },
  {
    // Entre features só a interface de propósito: componentes, actions, stores e hooks (e tipos).
    // Helper usado por mais de uma feature vai para lib/ ou components/.
    files: ['src/renderer/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['electron'],
          patterns: [
            {
              group: ['node:*'],
              message: 'O renderer roda em sandbox; peça ao main via window.api.',
            },
            {
              group: ['**/main/**', '**/preload/**'],
              message: 'Use window.api e tipos de @shared.',
            },
            {
              regex: String.raw`^\.\./(?!\.\.)[^/]+/(?![A-Z])(?!use-)(?!.*\.(actions|store)$)`,
              caseSensitive: true,
              allowTypeImports: true,
              message:
                'Arquivo interno de outra feature. Use o componente, a action, o store ou o hook; helper compartilhado vai para lib/.',
            },
          ],
        },
      ],
    },
  },
  {
    // Scripts Node em CommonJS (ex.: agente falso dos testes e2e).
    files: ['**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // useIpcQuery recebe deps como um useEffect: o ESLint confere os deps de cada chamada.
      'react-hooks/exhaustive-deps': ['error', { additionalHooks: '(useIpcQuery)' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  prettier,
)
