# Decisões

Decisões fáceis de desfazer, não cobertas pelo `AGENTS.md`. Mais recente no fim.

## Fase 0

- **Versões fixadas por compatibilidade.** Vite 7 (não 8), porque o electron-vite 5 só aceita
  Vite ≤ 7. TypeScript 6.0 (não 7), porque o typescript-eslint só aceita TS < 6.1.
  `@vitejs/plugin-react` 5 pelo mesmo motivo. Rever quando o electron-vite 6 sair do beta.
- **React 19.** O AGENTS.md pede 18+; 19 é a versão estável atual.
- **Download do Electron no `postinstall`.** O Electron 44 não baixa mais o binário na
  instalação (faz isso sob demanda), e o electron-vite 5 falha se ele não existir. O
  `postinstall` roda `install-electron` antes do `electron-rebuild`.
- **`nodeLinker: hoisted`.** `node_modules` plano, que evita problemas de resolução com módulos
  nativos e com o empacotamento do Electron.
- **Contrato IPC incremental.** `ipc-contract.ts` declara só os canais já implementados; cada
  fase adiciona os seus. Assim o preload nunca expõe funções sem handler.
- **Wrapper de handler independente do Electron** (`main/ipc/handle.ts`). Valida com zod e
  converte exceções em `{ ok: false, error }`, testável sem Electron. Erros inesperados viram
  `INTERNAL` sem detalhes para o renderer; os detalhes ficam no log do main.
- **`lucide-react` para ícones.** Não estava na stack; é uma adição, não troca. Não tem ícones
  de marca, então o painel GitHub usa `GitPullRequest`.
- **Tokens de cor no `@theme` do Tailwind v4** (`surface-*`, `fg`, `border`, `accent`). Só tema
  escuro por enquanto.
- **CSP sem `frame-ancestors`.** A diretiva é ignorada em `<meta>`; quando houver necessidade,
  aplicar via cabeçalho com `session.webRequest`.
- **Bundle do renderer não minificado** (padrão do electron-vite). Como é carregado do disco, o
  tamanho importa pouco; rever no empacotamento.
- **`AGENTS.md` fora do Prettier.** É a especificação escrita à mão; não deve ser reformatado.
- **Playwright ainda não configurado.** Nenhum critério de aceite até aqui exige e2e. Entra
  quando a primeira fase precisar.

## Fase 1

- **`dockview-react`.** Na versão 8 do dockview, os componentes React saíram do pacote
  `dockview` para o `dockview-react` (mesma família, mesma versão).
- **Dockview já na Fase 1.** As abas do editor usam dockview desde agora, para os terminais da
  Fase 2 entrarem no mesmo layout. Painéis com `renderer: always`, que mantém o estado do
  Monaco ao trocar de aba.
- **Abrir pasta é decisão do main.** O renderer não informa caminhos de raiz arbitrários: só
  o diálogo nativo ou a lista de recentes (guardada no main, em `userData/workspace.json`)
  abrem uma raiz. Uma raiz por vez no MVP; o `WorkspaceGuard` já aceita várias (worktrees).
- **Regras de path.** Leitura e escrita seguem symlinks e exigem que o destino real esteja
  numa raiz. Criar, renomear e excluir operam na própria entrada e exigem o diretório pai real
  dentro da raiz. A raiz em si não pode ser renomeada nem excluída.
- **Excluir = mover para a lixeira** (`shell.trashItem`), sempre com confirmação.
- **Confirmações com diálogo nativo** (`dialog:confirm`), não modal em HTML.
- **`.gitignore` aninhado** respeitado, via pacote `ignore`, com cache invalidado pelo watcher.
- **Quick open com fuzzy próprio** (`lib/fuzzy.ts`): poucas linhas e testável. Lista até
  50 mil arquivos; acima disso avisa e trunca.
- **Codificação.** UTF-8, com BOM preservado ao salvar. Binário = byte nulo nos primeiros
  8000 bytes (mesma heurística do Git).
- **Renomear com arquivos abertos** reabre as abas no novo caminho, mantendo o conteúdo e o
  estado "não salvo" (o histórico de desfazer é perdido).
- **Menu próprio.** O menu padrão do Electron liga `Ctrl/Cmd+W` a "fechar janela"; aqui o
  atalho fecha a aba.
- **Playwright configurado** (`pnpm test:e2e`), dirigindo o app real. Os diálogos nativos e
  a lixeira são substituídos no processo main durante o teste. `AIC_USER_DATA_DIR` isola o
  perfil.
- **Tema do dockview:** Abyss com as variáveis trocadas pela paleta do app.

## Fase 2

- **Fallback do WebGL é o renderer DOM.** O xterm 6 removeu o renderer canvas e o
  `@xterm/addon-canvas` só suporta o xterm 5. Se o WebGL falhar ou perder o contexto, o xterm
  volta ao renderer DOM embutido.
- **Shell padrão:** `$SHELL` no Unix (`/bin/bash` ou `/bin/zsh` como fallback). No macOS roda
  como login shell (`-l`), como os terminais nativos. No Windows, `pwsh` se estiver no PATH,
  senão o `powershell` embutido. Um shell explícito vindo do renderer só é aceito se estiver
  em `/etc/shells` (ou for pwsh/powershell/cmd no Windows).
- **Env dos terminais sem as variáveis internas** (`ELECTRON_RENDERER_URL`,
  `AIC_USER_DATA_DIR`, ...). Sem isso, rodar `pnpm dev` de outro projeto Electron no terminal
  herdaria a URL do nosso renderer.
- **Saída do PTY agrupada em lotes de ~5 ms** antes do IPC. Aguenta saída intensa (testado com
  20 mil linhas) sem travar a UI. Não há controle de fluxo (backpressure) por enquanto.
- **Terminal pertence ao workspace.** Precisa de pasta aberta; o `cwd` é a raiz, validado pelo
  guard. Trocar de pasta salva e fecha os terminais da anterior e restaura os da nova.
- **Histórico:** ao fechar o app ou trocar de pasta, o scrollback (últimas 1000 linhas,
  `addon-serialize`) de cada terminal vai para `userData/terminal-sessions/<hash da raiz>.json`.
  Ao reabrir, os terminais voltam como abas, com o histórico e um novo shell. A disposição dos
  splits não é restaurada (possível melhoria).
- **Fluxo de fechamento.** O main intercepta o `close` da janela e pede ao renderer para
  perguntar sobre arquivos não salvos e salvar os terminais. Só fecha quando o renderer
  confirma. Se o renderer travou ou caiu, fecha direto. Depois, `killAll` nos PTYs.
- **Shell que sai com código 0 fecha a aba**; com outro código, a aba fica com a mensagem.
- **Atalhos dentro do terminal (Linux/Windows):** `Ctrl+S` e `Ctrl+W` vão para o shell (XOFF,
  apagar palavra); `Ctrl+P` e ``Ctrl+` `` continuam globais. `Ctrl+F` abre a busca do terminal.
  No Windows, `Ctrl+C` com seleção copia (como no Windows Terminal) e `Ctrl+V` cola.
- **Clipboard via IPC.** O renderer está em sandbox e a API de clipboard do navegador exigiria
  permissões; o main usa o `clipboard` do Electron.
- **Correções da Fase 1 encontradas aqui:** o Monaco não encolhia com a janela (contêiner flex
  com `min-width: auto`), o texto vazava por baixo do minimap (canvas com opacidade < 1) e um
  Enter no quick open antes de a lista carregar era ignorado.

## Fase 3

- **`simple-git` só como executor** (`raw`). Os comandos usam saídas estáveis para máquinas
  (`status --porcelain=v2 -z`, `for-each-ref --format`, `worktree list --porcelain`),
  interpretadas por parsers próprios e testados (`main/lib/git-parse.ts`).
- **Ambiente do git.** `GIT_OPTIONAL_LOCKS=0`: sem isso, o `git status` regrava `.git/index` e
  o watcher do `.git` entraria em ciclo. `GIT_TERMINAL_PROMPT=0` e sem editores/pagers
  (`EDITOR`, `GIT_EDITOR`, `PAGER`...), para o git nunca ficar esperando interação. O
  simple-git 4 bloqueia variáveis `GIT_*` e de SSH/askpass por padrão; como vêm do ambiente
  do próprio usuário (nunca do renderer), são liberadas explicitamente.
- **Entradas do renderer.** Nomes de branch passam por `git check-ref-format --branch` e não
  podem começar com `-` (seria lido como opção). Caminhos vão sempre depois de `--` e precisam
  estar na pasta aberta. O caminho da worktree é calculado no main.
- **Worktrees** em `../<repo>-worktrees/<branch>`, com `/` da branch trocado por `-`. Se a
  branch já existe e está livre, a worktree usa essa branch; senão cria uma nova a partir do
  HEAD. "Abrir worktree" só aceita caminhos listados por `git worktree list` do repositório
  aberto (`workspace:openWorktree`). Remover pede confirmação; se houver alterações não
  commitadas, pede uma segunda confirmação antes do `--force`.
- **Watcher do `.git`** (HEAD, index, refs; sem `objects`/`logs`), separado do watcher de
  arquivos, que ignora `.git`. Numa worktree, observa também o diretório comum do repositório.
  Assim o painel acompanha commits e checkouts feitos no terminal, o que a Fase 5 (agentes)
  precisa.
- **Diff somente leitura.** Duas visões: alterações (index × disco) e stage (HEAD × index).
  Para editar, "Abrir arquivo".
- **Sem "descartar alterações"** por enquanto: é destrutivo e não está no escopo da fase.
- **Pasta aberta como subpasta do repositório:** o status mostra só os arquivos dela.
- **Correções encontradas nesta fase:** o watcher começava depois da primeira leitura da
  árvore (arquivos criados nesse intervalo não apareciam), e trocar de aba na sidebar ou
  recolhê-la desmontava a árvore e perdia as pastas expandidas.

## Fase 4

- **Device Flow sem client secret.** Só o `GITHUB_CLIENT_ID` é necessário. O `device_code`
  fica no main; o renderer recebe só o código para o usuário, a URL e um id opaco do fluxo.
  Escopo `repo` (repositórios privados e criação de PRs).
- **Token:** `safeStorage` em `userData/github-token.bin` (modo 0600). No Linux, se o backend
  for `basic_text` (sem gnome-keyring/kwallet), o Electron só ofusca. Nesse caso o token fica só
  em memória e a UI avisa; nunca vai para o disco em texto puro. Token revogado (401) faz logout.
- **`@octokit/rest` 22 é ESM-only** e o main é CJS. O Node 24 do Electron 44 carrega ESM via
  `require`, sem configuração extra.
- **Repositório pelo `remote.origin.url` configurado**, não pelo `git remote get-url`: este
  aplica reescritas `insteadOf`, e o que interessa é o host GitHub declarado.
- **Fetch e push autenticados** com o token num header `http.<host>.extraheader` passado ao git
  por `GIT_CONFIG_COUNT/KEY/VALUE`, nunca na linha de comando (visível no `ps`) nem em log. Só
  para remotes https; remotes ssh usam as chaves do usuário.
- **"Abrir em worktree"** busca `refs/pull/N/head` (funciona também para PRs de forks) numa
  branch local com o nome da branch do PR. Se esse nome já existir localmente, usa `pr-N`. Se já
  houver worktree para o PR, reaproveita. A branch local não fica com upstream (enviar commits
  de volta a um PR fica para depois).
- **"Criar PR"** sempre a partir da branch atual: `git push -u origin <branch>` e depois a API.
  Alterações não commitadas geram um aviso. Não há suporte a criar PR a partir de fork.
- **Descrições de PR/issue em texto puro** (sem renderizar Markdown), para não puxar mais uma
  dependência; possível melhoria.
- **URLs configuráveis** (`GITHUB_API_URL`, `GITHUB_OAUTH_URL`, `GITHUB_HOST`): habilitam
  GitHub Enterprise e o servidor GitHub falso dos testes e2e.
- **Testes e2e** contra um servidor GitHub falso local e um repositório bare como `origin` (via
  `url.insteadOf`). Rodam com `--password-store=basic` para nunca tocar no chaveiro do sistema.
  O fluxo real com github.com precisa ser validado manualmente (ver README).
- **CSP:** `img-src` inclui `https://avatars.githubusercontent.com` (avatar do usuário).
- **Correções encontradas nesta fase:** a cor dos painéis do dockview não seguia a paleta (o
  override estava num descendente do elemento do tema), e `rev-parse --verify -q` falhando em
  silêncio era lido como sucesso pelo simple-git, que só rejeita quando há stderr.
