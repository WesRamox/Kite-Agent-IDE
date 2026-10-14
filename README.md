# AiController

IDE desktop para trabalhar com agentes de IA (Claude Code, Codex, Gemini CLI…), com arquivos,
terminais, Git/worktrees e GitHub. Especificação completa em [`AGENTS.md`](AGENTS.md).

**Status:** Fase 0 (fundação) concluída: janela com o layout base e IPC tipado.

## Requisitos

- Node.js 24+
- pnpm (via corepack: `corepack enable pnpm`)
- Toolchain de compilação para o `node-pty`:
  - Linux: `build-essential` e `python3`
  - macOS: Xcode Command Line Tools
  - Windows: Visual Studio Build Tools (workload "Desktop development with C++")

## Como rodar

```bash
pnpm install   # instala, baixa o binário do Electron e recompila o node-pty
pnpm dev       # abre o app em modo desenvolvimento (com HMR)
```

| Script           | O que faz                                    |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | App em modo desenvolvimento                  |
| `pnpm build`     | Typecheck + build de produção em `out/`      |
| `pnpm preview`   | Roda o build de produção                     |
| `pnpm lint`      | ESLint                                       |
| `pnpm typecheck` | `tsc` nos projetos node (main/preload) e web |
| `pnpm test`      | Testes unitários (Vitest)                    |
| `pnpm format`    | Prettier                                     |

Variáveis de ambiente:

- `LOG_LEVEL`: `debug` | `info` (padrão) | `warn` | `error`. Em `debug`, o console do renderer
  também aparece no terminal.

## Estrutura

```
src/
  main/       processo principal: janela, serviços, handlers IPC
  preload/    expõe window.api (só funções nomeadas)
  shared/     contrato IPC e tipos compartilhados
  renderer/   UI React
docs/decisions.md   decisões tomadas fora do AGENTS.md
```

Para adicionar um canal IPC: declare em `src/shared/ipc-contract.ts` (em `InvokeChannels` e em
`Api`), registre o handler com schema zod em `src/main/ipc/<dominio>.ipc.ts` e exponha a função
em `src/preload/index.ts`.
