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

## Fase 5

- **Agentes rodam no main**, num PTY do PtyService (`spawnAt`, sem passar pelo guard: a
  worktree foi criada pelo próprio app). O terminal no renderer só assiste: fechar a aba não para
  o agente, e trocar de pasta não fecha as abas de agentes. Ao reconectar, o main reenvia o
  histórico (até 500 mil caracteres) e cada evento de saída do PTY carrega `end` (total emitido),
  para o renderer juntar histórico e saída ao vivo sem duplicar.
- **Comando no shell do usuário**: `$SHELL -ilc "<comando> '<prompt>'"` (interativo + login,
  para valer o PATH do `.bashrc`/`.zshrc`, ex.: nvm); `pwsh -NoLogo -Command` no Windows. O
  prompt é escapado com aspas simples (POSIX: `'\''`; PowerShell: `''`), com teste contra o `sh`
  real. O código de saída do shell é o do agente.
- **Prompt inicial:** como argumento quando o CLI aceita (`claude`, `codex`, `gemini -i`); nos
  demais, digitado no terminal na primeira pausa (o CLI está pronto), sem notificar essa pausa.
  Os presets são editáveis e ficam em `userData/agents.json`.
- **Status por heurística** em `main/lib/agent-status.ts` (puro, isolado para trocar por hooks
  dos CLIs): `running` com saída de texto recente; `waiting` após 4 s sem texto. Sequências
  ANSI de cursor, cores e título não contam, porque TUIs redesenham mesmo paradas.
  `done`/`error` pelo código de saída. "Parar" encerra como `done`.
- **Notificação nativa** em `waiting`, `done` e `error` (também em erro, além do que a spec
  pede); clicar traz a janela e foca a tarefa.
- **Tarefas persistem** entre sessões. As que estavam rodando quando o app fechou voltam como
  "Interrompido" (status `error` + `interrupted`) e podem ser reiniciadas na mesma worktree. O
  fechamento da janela espera o estado dos agentes ser gravado.
- **Branch `agent/<slug>`** a partir da branch atual (sufixo `-2`, `-3`... se já existir);
  worktree em `../<repo>-worktrees/agent-<slug>`. Remover a tarefa pode apagar a worktree
  (`--force`); a branch é mantida.
- **Revisar:** arquivos alterados desde o merge-base com a branch de origem (commitados, não
  commitados e novos), com diff lado a lado. O renderer passa só o id da tarefa; os caminhos
  ficam no main.
- **A lista mostra as tarefas de todos os repositórios**, não só da pasta aberta; filtrar por
  repositório é uma melhoria possível.
- **Correção encontrada nesta fase:** gravações concorrentes no `JsonStore` usavam o mesmo
  arquivo temporário. Agora são enfileiradas e com nome único.
- **Testes e2e** com um agente falso (`e2e/fixtures/fake-agent.cjs`) num preset customizado; as
  notificações são interceptadas no main. Os CLIs reais (claude, codex...) não foram testados
  automaticamente.

## Temas e nome (Kite)

- **Nome do app: Kite** (`productName`). O perfil passa de `<appData>/ai-controller` para
  `<appData>/Kite`. Na primeira execução, os arquivos do app (recentes, agentes, sessões de
  terminal, configurações, token) são copiados do perfil antigo; os caches do Chromium não. O
  token do GitHub pode não decifrar depois da troca de nome; nesse caso basta entrar de novo.
  Variáveis internas `AIC_*` viraram `KITE_*`. A pasta do repositório não foi renomeada.
- **Ícone** em `resources/icon.svg` (e o PNG gerado a partir dele), usado na janela em dev. O
  ícone do instalador fica para quando houver empacotamento. O desenho é o cubo isométrico com
  topo âmbar (`#FFB224`) do canvas "Kite Logo"; as cores do logo são da marca e não seguem o
  tema, com a variante clara (`#F59E0B`, `#3A3734`, `#161514`) nos temas claros. O PNG foi
  renderizado a partir do SVG com o próprio Electron (janela offscreen + `capturePage`).
- **Temas por variáveis CSS:** cada tema redefine os tokens do Tailwind (`--color-surface-*`,
  `fg`, `accent` e os semânticos `success`, `warning`, `danger`, `info`, `merged`) em
  `[data-theme="<id>"]`. Cores fixas da UI (amber, emerald, red...) viraram tokens semânticos,
  senão ficariam ilegíveis nos temas claros. Ícones de arquivo usam a variante `light:`.
- **Kite (padrão)** usa as cores do logo: fundos grafite quentes `#0b0b0c`, `#111110`,
  `#181715`, `#22201d`, borda `#2c2a27` (a lateral escura do cubo), texto `#ededec`/`#a3a09a`,
  destaque âmbar `#ffb224`. Branco sobre âmbar não tem contraste, então há um token
  `--color-accent-fg` para o texto dos botões primários (escuro no Kite, branco nos demais).
  O id `kite` continua sendo o padrão, então quem tinha o Kite salvo passa para o novo.
- **Escuro** é a antiga paleta do Kite (estilo onorca.dev) levada ao preto total: fundos
  `#000000`, `#050505`, `#0c0c0c`, `#161616`, bordas a 8% de branco, destaque `#3b82f6`.
  "Meia-noite" é a paleta original do app; "Meio-termo" é um escuro acinzentado de menor
  contraste; "Claro" e "Papel" (claro quente) são os claros.
- **Monaco e xterm leem as cores do CSS**, sem paletas duplicadas em TS. Um elemento oculto com
  `data-theme` revela a paleta de qualquer tema; há um tema do Monaco por tema do app, porque o
  Monaco ignora `setTheme` com o mesmo nome. As cores passam por normalização para
  `#rrggbb(aa)`: o CSS do build é minificado (`#ffffff` vira `#fff`) e o Monaco recusa outros
  formatos. Isso foi encontrado ao testar o build de produção.
- **Persistência:** a escolha fica no main (`userData/settings.json`), que também ajusta o fundo
  da janela e `nativeTheme` (diálogos e menus nativos claros ou escuros). O renderer guarda uma
  cópia em `localStorage` para aplicar o tema antes do primeiro paint.
- **Sem menu e sem DevTools:** no Windows/Linux a janela não tem barra de menu
  (`Menu.setApplicationMenu(null)` + `removeMenu()`); no macOS fica só o menu do app e o Edit,
  necessários para Cmd+Q e para copiar/colar em campos de texto. `webPreferences.devTools` é
  `false`, então Ctrl+Shift+I/F12 não abrem o inspetor. Para depurar em dev:
  `KITE_DEVTOOLS=1 pnpm dev` (ignorado no app empacotado).
- **TypeScript no Monaco só com validação sintática.** O worker do Monaco vê cada arquivo
  isolado (sem tsconfig, `node_modules` nem os outros arquivos), então a validação semântica
  marcava todo import e todo JSX como erro. Fica só a sintática, com `jsx: ReactJSX` para
  `.tsx`. Erros de tipo de verdade ficam para o LSP (fora do MVP).
- **Cores do Monaco por tema** incluem seleção, realces de palavra/busca, colchetes, guias de
  indentação e scrollbar, derivadas do accent e do `fg-muted`; antes ficavam no azul padrão.
- **Temas do Monaco definidos sob demanda.** Em dev o Vite injeta o `styles.css` depois dos
  módulos JS; definir os temas no carregamento do `monaco-setup` lia variáveis CSS vazias, que
  viravam `#000000` (identificadores e números de linha invisíveis, só no `pnpm dev`). Agora os
  temas são definidos na primeira montagem de um editor, e `paletteOf` não guarda em cache uma
  paleta lida antes do CSS carregar.
- **Cores de sintaxe por tema** (`features/editor/syntax-themes.ts`), adaptadas de temas
  populares do VS Code: Kite ← Ayu Dark, Escuro ← One Dark Pro, Meia-noite ← Tokyo Night,
  Meio-termo ← GitHub Dark Dimmed, Claro ← GitHub Light, Papel ← Gruvbox Light (comentário
  escurecido para contraste). Ficam em TS porque são só do editor; fundo, texto comum e UI do
  Monaco continuam vindo do CSS. Inclui as cores dos pares de colchetes.
- **Favicon** (`src/renderer/public/favicon.svg`) é só o cubo do logo, sem fundo e sem o nome.
