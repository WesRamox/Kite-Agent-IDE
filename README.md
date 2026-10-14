# AiController

IDE desktop para trabalhar com agentes de IA (Claude Code, Codex, Gemini CLI…), com arquivos,
terminais, Git/worktrees e GitHub. Especificação completa em [`AGENTS.md`](AGENTS.md).

**Status:** Fases 0, 1 e 2 concluídas: fundação, explorador de arquivos, editor e terminais.

O que já funciona:

- Abrir pasta (diálogo nativo) e pastas recentes
- Árvore de arquivos virtualizada: criar, renomear (F2), mover para a lixeira (Delete), com
  `.git`, `node_modules`, `dist`, `build`, `.next` e o `.gitignore` respeitados
- Atualização automática quando arquivos mudam fora da IDE
- Editor Monaco com abas, indicador de "não salvo", detecção de linguagem e Ln/Col
- Recarga de arquivos alterados no disco (pergunta se houver alterações locais)
- Quick open com busca fuzzy
- Terminais reais (PTY) com o shell padrão do SO, em abas e splits (botões no cabeçalho do
  grupo), WebGL, busca (`Ctrl/Cmd+F`), links clicáveis e copiar/colar (`Ctrl+Shift+C/V`;
  `Cmd+C/V` no macOS)
- Histórico dos terminais salvo ao fechar o app (ou trocar de pasta) e restaurado ao reabrir
- Ao fechar a janela: pergunta sobre arquivos não salvos e encerra todos os processos
- Atalhos: `Ctrl/Cmd+S` salvar, `Ctrl/Cmd+P` quick open, `Ctrl/Cmd+W` fechar aba,
  ``Ctrl/Cmd+` `` abrir/focar terminal, ``Ctrl/Cmd+Shift+` `` novo terminal. No Linux/Windows,
  com o foco no terminal, `Ctrl+S` e `Ctrl+W` vão para o shell.

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
e2e/        testes e2e (Playwright dirigindo o Electron)
docs/decisions.md   decisões tomadas fora do AGENTS.md
```

Para adicionar um canal IPC: declare em `src/shared/ipc-contract.ts` (em `InvokeChannels` e em
`Api`), registre o handler com schema zod em `src/main/ipc/<dominio>.ipc.ts` e exponha a função
em `src/preload/index.ts`.

Variáveis de ambiente úteis para testes: `AIC_USER_DATA_DIR` troca a pasta de perfil (pastas
recentes etc.).
