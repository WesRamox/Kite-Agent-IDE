# AiController

IDE desktop para trabalhar com agentes de IA (Claude Code, Codex, Gemini CLI…), com arquivos,
terminais, Git/worktrees e GitHub. Especificação completa em [`AGENTS.md`](AGENTS.md).

**Status:** Fases 0 a 4 concluídas: fundação, explorador de arquivos, editor, terminais, Git local e GitHub.

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
- Git: status colorido na árvore (M/U/A/D), painel com stage/unstage por arquivo, commit
  (`Ctrl/Cmd+Enter`), diff lado a lado no Monaco, criar e trocar de branch
- Worktrees: listar, criar em `../<repo>-worktrees/<branch>`, abrir como workspace e remover;
  branch e worktree atuais na status bar
- O painel Git acompanha commits e checkouts feitos fora da IDE (terminal, agentes)
- GitHub: login por Device Flow, PRs e issues do repositório (filtro por estado), detalhes do PR
  com checks, "Abrir em worktree" e "Criar PR da branch atual" (faz o push e abre o PR)
- Histórico dos terminais salvo ao fechar o app (ou trocar de pasta) e restaurado ao reabrir
- Ao fechar a janela: pergunta sobre arquivos não salvos e encerra todos os processos
- Atalhos: `Ctrl/Cmd+S` salvar, `Ctrl/Cmd+P` quick open, `Ctrl/Cmd+W` fechar aba,
  ``Ctrl/Cmd+` `` abrir/focar terminal, ``Ctrl/Cmd+Shift+` `` novo terminal. No Linux/Windows,
  com o foco no terminal, `Ctrl+S` e `Ctrl+W` vão para o shell.

## Requisitos

- Node.js 24+
- Git 2.23+ no PATH
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

- `GITHUB_CLIENT_ID`: Client ID do OAuth App usado no login com GitHub (veja abaixo).
- `GITHUB_API_URL`, `GITHUB_OAUTH_URL`, `GITHUB_HOST`: para GitHub Enterprise (padrões:
  `https://api.github.com`, `https://github.com`, `github.com`).
- `LOG_LEVEL`: `debug` | `info` (padrão) | `warn` | `error`. Em `debug`, o console do renderer
  também aparece no terminal.

## Login com GitHub

O login usa o OAuth **Device Flow**, então o app não precisa de client secret.

1. Em <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
   - _Homepage URL_: qualquer URL (ex.: a do seu repositório).
   - _Authorization callback URL_: obrigatório no formulário, mas não é usado pelo Device
     Flow (ex.: `http://127.0.0.1/callback`).
2. Na página do app, marque **Enable Device Flow** e salve.
3. Copie o **Client ID** e rode o app com ele:

   ```bash
   GITHUB_CLIENT_ID=Ov23li... pnpm dev
   ```

4. Na aba GitHub, clique em **Entrar com GitHub**. O código é copiado para a área de
   transferência e o navegador abre a página para colá-lo.

O token (escopo `repo`) é guardado criptografado com o cofre do sistema (`safeStorage`). Se o
sistema não tiver um cofre (ex.: Linux sem gnome-keyring/kwallet), o token fica só em memória e
o login vale até fechar o app. Ele nunca é gravado em texto puro.

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
