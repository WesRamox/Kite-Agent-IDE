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
- Temas: Kite (padrão, grafite com âmbar, nas cores do logo), Escuro (preto total),
  Meia-noite, Meio-termo, Claro e Papel, no ícone de paleta da barra lateral. A escolha vale para editor, terminais e diálogos
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
- `KITE_DEVTOOLS=1`: libera o DevTools (Ctrl+Shift+I) em `pnpm dev`. Ignorado no app empacotado.
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

Os presets ficam em Conectar agentes → Outros CLIs → Ajustar e podem ser editados: comando e como o prompt
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

### Tarefas multi-repo

Abra a pasta que reúne os seus repositórios (ex.: `~/projetos`). O Kite acha os repos (até dois
níveis), lista as worktrees de cada um e agrupa em **tarefas**, sem você precisar criá-las por ele:

- **Automático:** worktrees de repos diferentes na mesma pasta (ex.: `.worktrees/PAY-412/api` e
  `.worktrees/PAY-412/web`) ou com o mesmo nome de branch, ignorando prefixos como `feat/`.
- **Por padrão de pasta** (ex.: `.worktrees/{tarefa}/{repo}`) ou **manual**.

Na primeira vez aparece a tela **Descobrir tarefas** para conferir, renomear, desmarcar e decidir o
que fazer com worktrees soltas; para voltar a ela, `Ctrl/Cmd+K` → "Descobrir tarefas…". Um
`TASK.md` (primeiro título) ou `.kite-task.json` (`{ "title", "url" }`) na pasta da tarefa dá o
título e o link do card. Worktrees criadas depois, por qualquer script ou skill, entram sozinhas.

Abrir uma tarefa (na Central ou `Ctrl/Cmd+K`) mostra um explorer com uma raiz por worktree, o
quick open busca em todos os repos dela, as abas mostram o repo do arquivo e os terminais abrem
na pasta da tarefa (botão direito numa raiz: "Abrir terminal aqui"). Cada tarefa guarda as
próprias abas e terminais: trocar de tarefa não fecha nada. À direita ficam o card, a situação de
cada repo, as sessões de agente e notas. Uma sessão do Claude Code é ligada à tarefa pelo cwd ou
pelos arquivos que edita (mesmo aberta na raiz do workspace); em Conectar agentes dá para
vincular à mão.

### Revisar e entregar uma tarefa

"Revisar" (na Central, ou botão direito na tarefa → "Revisar mudanças") abre a revisão da tarefa:
os arquivos alterados agrupados por repo, com `+/-`, contra o merge-base com a branch base de
cada repo (a padrão do `origin`, senão `main`/`master`), e o diff de cada arquivo (em linha ou
lado a lado). Inclui o que ainda não foi commitado.

- **Commit e PR nos N repos:** uma mensagem de commit para todos, título e descrição do PR, base
  por repo e rascunho opcional. Cada repo é commitado (`git add -A`), enviado ao `origin` e ganha
  um PR; com mais de um repo, cada PR recebe no fim da descrição os links dos outros PRs da
  tarefa. Um PR já aberto para a branch só é atualizado com o push. "Commit em <repo>" e "Abrir
  PR" fazem o mesmo para um repo só. Requer login no GitHub (seção acima).
- **Pedir ajuste ao agente:** o texto vai direto para o prompt da sessão ligada à tarefa, se ela
  roda num terminal do Kite; se roda fora, o Kite oferece "Retomar aqui".
- Os detalhes da tarefa mostram o PR de cada repo ("sem PR", "PR #42 aberto"...).

### Central de atenção

O primeiro ícone da activity bar abre a **Central de atenção**: na sidebar, as tarefas e sessões
agrupadas em Esperando você, Trabalhando, Para revisar e Sem agente; na área principal, o que
cada agente parado pede (o comando que quer rodar ou a última mensagem), o que os outros estão
fazendo e o que terminou. Com o Claude Code conectado, o app já abre nela.

- `Ctrl/Cmd+K` troca de tarefa (no terminal, `Ctrl+Shift+K`).
- `Ctrl/Cmd+J` vai para o próximo agente que espera, do que espera há mais tempo. Com o foco num
  terminal, use `Ctrl+Shift+J` (lá `Ctrl+J` é quebra de linha).
- "Responder no terminal" vai até a aba do agente, inclusive quando o `claude` foi aberto à mão
  num terminal do Kite.
- "Retomar aqui" abre `claude --resume <sessão>` num terminal do Kite, na pasta da sessão (que
  precisa estar dentro da pasta aberta); o botão `claude --resume` copia o comando.
- Botão direito numa tarefa do Kite: terminal, revisar, parar/reiniciar e remover. Os presets dos
  agentes ficam em Conectar agentes → Outros CLIs → Ajustar.

### Nova tarefa pelo Kite

Na Central, "+ Nova": nome da tarefa, branch (sugerida a partir do nome), os repositórios, o agente
e um prompt inicial opcional. O Kite cria uma worktree por repo na branch escolhida, seguindo o
padrão de pasta do workspace (`.worktrees/{tarefa}/{repo}` por padrão, com um `TASK.md` com o
título), abre a tarefa e inicia o agente na pasta dela. Quando a pasta aberta é um repositório só,
a worktree vai para `../<repo>-worktrees/<branch>`. Escolher "Nenhum" no agente só cria a tarefa.
Numa tarefa aberta, o ícone de robô no cabeçalho dos terminais abre mais um agente na pasta dela.

### Saber quando um agente espera você (Claude Code, Codex, Gemini CLI)

Em Conectar agentes (status bar → "Conectar Claude Code"), cada CLI tem o seu botão: o Kite
instala hooks no `~/.claude/settings.json`, no `~/.codex/hooks.json` ou no
`~/.gemini/settings.json`. A partir daí, toda sessão do CLI (aberta no Kite ou em qualquer outro terminal) avisa o Kite quando pede permissão,
termina o turno ou edita arquivos. As sessões aparecem na mesma tela, o número de agentes
esperando você fica na activity bar e na status bar, e chega uma notificação nativa.

- Vale para sessões abertas depois de conectar.
- Os hooks existentes são mantidos; o original fica em `settings.json.kite-backup`. "Remover"
  tira só o que o Kite adicionou.
- O hook chama `kite-hook.sh` (na pasta de perfil do Kite), que grava os eventos em
  `agent-events/` na mesma pasta. Ficam só caminhos de arquivo e trechos das mensagens do agente,
  nunca o conteúdo dos arquivos. Arquivos sem eventos há 7 dias são apagados.
- O Codex pede para revisar e confiar nos hooks na primeira sessão depois de conectar.
- `KITE_CLAUDE_SETTINGS`, `KITE_CODEX_HOOKS`, `KITE_GEMINI_SETTINGS`: trocam o caminho de cada
  arquivo (usado nos testes).

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
