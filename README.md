# Kite

IDE desktop para trabalhar com agentes de IA (Claude Code, Codex, Gemini CLI…), com arquivos,
terminais, Git/worktrees e GitHub. Especificação completa em [`AGENTS.md`](AGENTS.md).

**Status:** MVP completo (fases 0 a 5): arquivos, editor, terminais, Git/worktrees, GitHub e agentes.

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
- Agentes: "Nova tarefa" cria a branch `agent/<nome>` e uma worktree própria e roda o CLI
  (Claude Code, Codex, Gemini CLI, OpenCode ou comando customizado) com o prompt inicial. O
  painel mostra status (trabalhando / aguardando você / concluído / erro), branch, worktree e
  tempo. Notificação nativa quando um agente para ou termina. "Revisar" mostra o diff da
  worktree contra a branch de origem.
- Histórico dos terminais salvo ao fechar o app (ou trocar de pasta) e restaurado ao reabrir
- Ao fechar a janela: pergunta sobre arquivos não salvos e encerra todos os processos
- Temas: Kite (padrão, escuro neutro no estilo do Orca), Meia-noite, Meio-termo, Claro e
  Papel, no ícone de paleta da barra lateral. A escolha vale para editor, terminais e diálogos
  nativos e é lembrada entre sessões
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
- `KITE_USER_DATA_DIR`: troca a pasta de perfil (usado nos testes).
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

## Agentes

Os presets ficam na aba Agents (ícone de ajustes) e podem ser editados: comando e como o prompt
inicial é passado (como argumento, com flag opcional, ou digitado no terminal quando o agente
fica pronto). O comando roda no seu shell como shell interativo de login (`$SHELL -ilc`), então o
PATH do seu `.bashrc`/`.zshrc` vale (ex.: CLIs instalados via nvm).

| Preset      | Comando padrão | Prompt          |
| ----------- | -------------- | --------------- |
| Claude Code | `claude`       | argumento       |
| Codex       | `codex`        | argumento       |
| Gemini CLI  | `gemini`       | `-i "<prompt>"` |
| OpenCode    | `opencode`     | digitado        |
| Customizado | (defina)       | digitado        |

Os CLIs precisam estar instalados e autenticados por conta própria.

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

O app se chamava AiController. Na primeira execução como Kite, os dados do perfil antigo
(`~/.config/ai-controller` no Linux) são copiados para o novo (`~/.config/Kite`).
