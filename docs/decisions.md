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

## Fase 6 — Eventos de agentes (hooks do Claude Code)

- **Spool em arquivo em vez de socket/HTTP.** O hook só acrescenta uma linha JSON em
  `userData/agent-events/<session_id>.jsonl`; o Kite observa a pasta com `@parcel/watcher` e lê
  só o que é novo. Funciona com o Kite fechado (o estado é reconstruído ao abrir), não abre
  porta nem precisa de token, e o hook nunca espera pelo Kite.
- **`kite-hook.js` roda no binário do Electron** com `ELECTRON_RUN_AS_NODE=1`, sem depender de
  Node instalado. É um segundo ponto de entrada do build do main. Um script `kite-hook.sh` na
  pasta de perfil guarda os caminhos (Electron, script, spool) e é recriado a cada abertura, já
  que os caminhos mudam entre versões e em dev. O comando gravado no `settings.json` é
  `[ -x '<kite-hook.sh>' ] && '<kite-hook.sh>'; exit 0`: se o Kite for desinstalado sem remover
  os hooks, o Claude Code não mostra erro.
- **Hook passivo:** nunca imprime nada (em `SessionStart`/`UserPromptSubmit` a saída viraria
  contexto do agente), sempre sai com 0, tem timeout de 10 s e corta a si mesmo em 5 s.
- **Eventos usados:** `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`,
  `PostToolUse`, `Notification`, `Stop` (traz `last_assistant_message`) e `SessionEnd`.
  `PermissionRequest` e `Notification(permission_prompt)` viram "pede permissão"; `Stop` e
  `idle_prompt` viram "sua vez"; diálogos (`elicitation_*`, `agent_needs_input`) viram "precisa
  de resposta". Arquivos tocados vêm de `PostToolUse` de `Edit`, `Write`, `MultiEdit` e
  `NotebookEdit`.
- **Privacidade:** o registro guarda só caminhos, nome da ferramenta, o comando do Bash (no pedido
  de permissão), o texto do aviso, o início do primeiro pedido e um trecho da última resposta,
  todos cortados. Nunca `tool_response` nem conteúdo de arquivo.
- **Agentes abertos pelo Kite** recebem `KITE_AGENT_ID` no ambiente; o hook repassa o id e, a
  partir do primeiro evento, o status deles vem dos hooks (a heurística do terminal fica só para
  CLIs sem integração). A notificação desses agentes continua sendo a do `AgentService`, para não
  duplicar.
- **Tela "Conectar agentes" fiel ao canvas**, com três diferenças necessárias nesta fase: Codex e
  Gemini aparecem como "Em breve" com o botão desabilitado (adaptadores na Fase 10); "Vincular
  a…" fica desabilitado até existirem tarefas (Fase 8); sessões abertas pelo Kite mostram
  "Aberta pelo Kite · <tarefa>" e "Abrir terminal". O trecho do `settings.json` mostra só o nome
  `kite-hook.sh`, como no desenho; o caminho completo está no arquivo.
- **Fonte Geist** (`@fontsource-variable/geist` e `geist-mono`) empacotada localmente, usada nas
  telas desenhadas no canvas (`font-geist`, `font-geist-mono`).
- **A verificar em outros SOs:** o comando do hook é POSIX (no Windows o Claude Code usa Git Bash
  ou PowerShell; precisa de um `.cmd`); no app empacotado do macOS, o fuse `runAsNode` precisa
  continuar ligado e o `kite-hook.js` precisa ser legível fora do asar.

## Fase 7 — Central de atenção

- **Moldura do canvas no app inteiro:** activity bar com o logo no topo e botões de 36 px,
  sidebars de 288 px com cabeçalho em versalete, status bar de 26 px com as contagens da Central
  (esperando, trabalhando, para revisar) e "Claude Code conectado" à direita. Geist virou a fonte
  da interface (`--font-sans`/`--font-mono`); editor e terminais continuam com JetBrains Mono por
  enquanto (trocar a fonte do xterm exige carregar a web font antes de abrir o terminal; fica para
  a tela de tarefa, Fase 8). Árvore do Explorer com linhas de 26 px e seleção em `surface-3`.
  Sem número de versão na status bar (não está no desenho).
- **A view Agents virou a Central:** a sidebar lista tarefas do Kite e sessões dos hooks
  agrupadas; "+ Nova" abre o formulário de tarefa. Ações que não estão no desenho foram para o
  menu de contexto das tarefas do Kite (terminal, revisar, parar/reiniciar, remover) e os presets
  para Conectar agentes → Outros CLIs → Ajustar.
- **Grupos:** sessão ociosa (aberta, sem pedido) e sessão encerrada sem arquivos editados não
  aparecem (ficam só em Conectar agentes). Encerradas com edições ficam 12 h em "Para revisar".
  Agentes do Kite parados com erro, interrompidos ou parados à mão ficam em "Sem agente".
- **Rótulo curto (fonte mono)** é o nome da pasta da sessão ou do repositório, e o nome é o
  primeiro pedido da sessão. Na Fase 8 os dois passam a vir da tarefa.
- **`KITE_PTY_ID`** em todo PTY do Kite chega aos hooks: uma sessão do `claude` aberta à mão num
  terminal do Kite também tem "Responder no terminal". Sessões de fora têm "Retomar aqui", que só
  funciona dentro da pasta aberta (o PTY não abre fora dela); fora, o comando é copiado.
- **`Ctrl+J`** é quebra de linha no terminal (e no prompt do Claude Code), então com o foco no
  terminal só `Ctrl+Shift+J` pula para o próximo que espera.
- **Abertura:** com o Claude Code conectado, o app abre na Central (view e aba). Sem a integração,
  continua abrindo no Explorer com a tela de boas-vindas.
- **Diferenças do desenho nesta fase:** sem "Abrir tarefa" (Fase 8) e sem "Revisar mudanças" para
  sessões de fora (Fase 9); o botão do workspace na sidebar abre o seletor de pasta e mostra
  "1 repo" (vários repos na Fase 8); estados vazios ganharam uma frase curta.

## Fase 8 — Tarefas multi-repo

- **Workspace = a pasta aberta.** Repositórios são as pastas com `.git` (diretório) nela e em
  até dois níveis abaixo, sem descer em repositórios, pastas ignoradas ou ocultas; repos de fora
  entram pelo diálogo nativo ("+ Adicionar repo de outra pasta") e ficam salvos por workspace.
- **Agrupamento automático**, em ordem: (1) pasta pai em comum com worktrees de repos diferentes
  (ou uma só com o nome do repo) — uma pasta com várias worktrees do mesmo repo, como
  `api-worktrees/`, é pasta de worktrees e não tarefa; (2) mesmo nome de branch, sem os prefixos
  `feat/`, `feature/`, `fix/`, `bugfix/`, `hotfix/`, `chore/`, `refactor/`, `agent/`, `task/`,
  `wip/`. Uma worktree sozinha com branch própria vira tarefa de um repo; sem branch (detached)
  fica "Sem tarefa". Os ids são estáveis (`folder:<pasta>`, `branch:<nome>`, `pattern:<chave>`,
  `manual:<uuid>`), então renomear, esconder, mover e ignorar continuam valendo nas próximas
  descobertas. Ajustes em `userData/tasks.json`, por workspace.
- **Segurança:** abrir uma tarefa adiciona as worktrees dela (e a pasta da tarefa) às raízes do
  `WorkspaceGuard`, mas só caminhos que o próprio `git worktree list` dos repositórios do
  workspace devolve. Trocar de workspace fecha tudo, como antes.
- **Observação:** o `.git` de cada repositório (sem `objects/`, `logs/`, `hooks/`) com debounce de
  300 ms; worktree criada, removida ou trocando de branch redescobre e avisa o renderer.
- **Um dockview por tarefa aberta.** O workspace e cada tarefa têm o próprio dock; só o ativo
  aparece. Os outros continuam montados (tamanho preservado, sem refazer xterm e Monaco),
  escondidos por `[data-hidden-context]`, que precisa de `visibility: hidden !important` em todos
  os descendentes porque o dockview força `visibility` em partes das abas. As ações agem no dock
  ativo; fechar um arquivo libera o modelo só quando nenhum outro contexto o mostra. Os terminais
  restaurados ao reabrir continuam sendo só os do workspace.
- **Ligação sessão ↔ tarefa** no renderer: vínculo manual; senão cwd dentro da pasta da tarefa ou
  de uma worktree; senão a tarefa da maioria dos arquivos editados. Sessões de agentes abertos pelo
  Kite (Fase 5) continuam no item do agente.
- **Central com tarefas:** cada tarefa importada e não escondida é um item, no grupo da sessão que
  mais pede atenção (espera > trabalha > terminou com mudanças); sem sessão, "Sem agente" (clicar
  abre a tarefa). Chips por repo contam os arquivos editados em cada worktree. Quando a tarefa não
  tem título, o rótulo curto não se repete ao lado do nome.
- **Fonte do código:** editor, diffs e terminais em Geist Mono (como no canvas). O terminal espera
  a fonte carregar (até 1,5 s) antes de abrir, para medir os glifos certos.
- **`Ctrl+K`** troca de tarefa; no terminal (onde `Ctrl+K` apaga até o fim da linha), `Ctrl+Shift+K`.
- **"+ Adicionar repositório à tarefa"** cria a worktree na pasta da tarefa (ou em
  `../<repo>-worktrees/<branch>`) com a branch mais comum da tarefa, criando-a a partir do `HEAD`
  do repositório se não existir.
- **Diferenças do desenho nesta fase:** os terminais da tarefa são os do dockview (sem o botão
  "+ Agente", que vem com a "Nova tarefa" da Fase 10); o cartão de cada repo mostra o upstream no
  lugar do status do PR (PRs na Fase 9) e "nada à frente" em vez de "nada commitado"; as notas são
  editáveis (o desenho mostra só o texto); a tela de descoberta ganhou um campo para o padrão de
  pasta quando esse modo está escolhido.

## Fase 9 — Revisão e entrega multi-repo

- **Base de cada repo:** `refs/remotes/origin/HEAD` (a branch padrão do GitHub), senão `main` ou
  `master` locais, senão `main`. O diálogo deixa trocar por repo antes de abrir o PR. Nomes de
  branch vindos do renderer passam por uma validação (sem `-` no início, sem `..`) porque viram
  argumento do git.
- **O que entra na revisão:** tudo desde o merge-base com a base, inclusive o que não foi
  commitado e arquivos novos (que contam as linhas do arquivo inteiro como adicionadas). É a mesma
  base do diff dos agentes (Fase 5), agora com `+/-` por arquivo (`git diff --numstat`).
- **Entrega em série:** por repo, commit (se houver alterações; `git add -A` na worktree), push e
  PR (`GitHubService.createPR`). Falha num repo não interrompe os outros; o resultado mostra cada
  um. Se já há um PR aberto para a branch, só faz o push e não mexe na descrição dele.
- **Links cruzados:** depois de abrir os PRs, cada PR criado agora tem a descrição atualizada com
  uma seção "PRs desta tarefa" com os links dos outros (inclusive de PRs que já existiam). Criar
  e depois editar evita depender da ordem de criação.
- **"Pedir ajuste ao agente"** escreve no PTY da sessão ligada à tarefa (a que espera há mais
  tempo, senão a que trabalha) com bracketed paste e Enter, para um texto de várias linhas chegar
  inteiro ao prompt do Claude Code. Sessão de fora do Kite: oferece "Retomar aqui".
- **PR nos detalhes da tarefa:** busca o PR mais recente da branch de cada worktree ao abrir a
  tarefa e depois de entregar. Sem GitHub ou sem login, não mostra nada (em vez de "sem PR").
- **Tela de revisão fiel ao canvas**, como um painel da tarefa (com o explorer e os detalhes ao
  lado, por isso a lista de arquivos tem largura fixa e o diff ocupa o resto). Diferenças: o diff
  é o diff editor do Monaco (em linha por padrão, "Lado a lado" alterna), e "Abrir PR" vira um
  link "PR #n" quando o repo já tem PR. O diálogo de commit e PR e o de pedir ajuste não estão no
  canvas e seguem o estilo dos outros diálogos do app.
- **Mock do GitHub nos e2e** passou a simular vários repos (`acme/<repo>`), busca de PR por
  branch e edição da descrição.

## Fase 10 — Outros agentes e nova tarefa pelo Kite

- **Codex pelos hooks, não pelo `notify`.** O `notify` do Codex só avisa o fim do turno; os hooks
  (`~/.codex/hooks.json`) têm os mesmos nomes de evento do Claude Code, inclusive
  `PermissionRequest` e `Stop` com `last_assistant_message`, então o Codex ganha "pede permissão"
  como o Claude. O Codex exige revisar e confiar em hooks novos: o aviso aparece ao conectar.
  Arquivos tocados vêm do texto do `apply_patch` (`*** Update/Add/Delete File:`); comandos podem
  vir como lista e são juntados.
- **Gemini CLI** (`~/.gemini/settings.json`): eventos traduzidos para os nomes do Claude
  (`BeforeAgent` → pedido, `AfterAgent` → fim do turno com `prompt_response`, `BeforeTool`/
  `AfterTool`, `Notification`/`ToolPermission` → pede permissão). Timeout em milissegundos. Como o
  Gemini espera JSON na saída do hook, o `kite-hook.sh` responde `{}` para ele (para os outros, nada).
  Sessão e cwd também vêm de `GEMINI_SESSION_ID`/`GEMINI_CWD`. O ambiente dos hooks do Gemini é
  "sanitizado", então `KITE_PTY_ID` pode não chegar: sessões do Gemini abertas num terminal do Kite
  podem aparecer como "fora do Kite".
- **Um adaptador por CLI** (`HOOK_TARGETS`: arquivo, eventos, unidade do timeout), um
  `HooksService` por CLI e o mesmo `kite-hook.sh`, que recebe o nome do CLI como argumento. O
  comando gravado para o Claude continua sem argumento, compatível com o que já estava instalado.
- **Retomar sessão** usa o comando de cada CLI: `claude --resume`, `codex resume`,
  `gemini --resume`.
- **Nova tarefa:** a branch sugerida é o nome sem acentos e espaços (sem prefixo `agent/`). As
  worktrees seguem o padrão de pasta do workspace (no modo automático ou manual, o padrão
  `.worktrees/{tarefa}/{repo}`); a pasta da tarefa ganha um `TASK.md` com o título. Workspace que é
  um repo só: `../<repo>-worktrees/<branch>`, como antes. Criar uma tarefa marca o workspace como
  importado (a tarefa aparece na Central na hora). No modo manual, a tarefa é montada à mão com as
  worktrees criadas.
- **Agente na pasta da tarefa:** `agent:startInTask` resolve a pasta no main (pasta da tarefa ou a
  primeira worktree) e o `AgentService.startIn` só abre o processo ali; o agente guarda
  `wsTaskId`. Remover o agente nunca apaga a pasta da tarefa. Na Central, esses agentes aparecem
  dentro do item da tarefa (com hooks, vale a sessão; sem hooks, a heurística do terminal), e o
  menu de contexto da tarefa ganha as ações do agente. "Revisar" de uma tarefa abre a revisão
  multi-repo (Fase 9), não a do agente.
- **O fluxo da Fase 5 virou caso particular:** o formulário "Nova tarefa" é o mesmo, com um repo
  marcado.
- **Terminal de agente é um só:** se a aba do agente já está aberta no dock de outra tarefa,
  "Terminal do agente" vai até aquela tarefa em vez de abrir uma segunda aba presa ao mesmo
  terminal (bug encontrado nos e2e desta fase).
- **"+ Agente"** (canvas, tela 2) no cabeçalho dos grupos de terminal da tarefa aberta, com os
  presets que têm comando.
- **A verificar:** Codex e Gemini não estavam instalados na máquina de desenvolvimento; os
  formatos seguem a documentação oficial e foram testados com eventos simulados pelo próprio
  `kite-hook.sh`. Vale confirmar com os CLIs reais o formato do `hooks.json` do Codex e os campos
  de `details` da notificação de permissão do Gemini.

## Configuração por `.env`

- **`.env` sem dependência nova.** Um parser pequeno em `src/main/lib/env-file.ts` lê o `.env` da
  pasta do projeto (só em `pnpm dev`) e o da pasta de perfil (`userData/.env`, vale no app
  empacotado). O primeiro arquivo que define uma chave vence, e o ambiente vence os dois, mesmo
  com valor vazio (os e2e usam `GITHUB_CLIENT_ID=''` para testar o caso sem login).
- **Só chaves conhecidas** (`GITHUB_CLIENT_ID`, `GITHUB_API_URL`, `GITHUB_OAUTH_URL`,
  `GITHUB_HOST`, `KITE_DEVTOOLS`) entram no `process.env`, para o resto do arquivo não vazar para os
  terminais. `LOG_LEVEL` fica de fora porque o logger já leu o nível antes do `.env` ser carregado.

## Explorer da tarefa em "Alterados"

- **Desvio combinado do canvas (tela 2).** O canvas mostra a árvore inteira de cada worktree,
  destacando os alterados. A pedido do usuário, o explorer da tarefa abre em **Alterados**: por
  repo, só os arquivos que mudaram contra a branch base (commitados na branch ou não, a mesma conta
  da revisão), agrupados por pasta. Um seletor "Alterados | Todos" volta para a árvore completa.
- **Canal leve `review:changes`.** O `review:task` calcula +/- e consulta o PR no GitHub; para
  atualizar a lista a cada mudança no git das worktrees, o novo canal só lista os arquivos.
- **Arquivo removido** não abre no editor: o clique leva para a revisão da tarefa, onde está o diff.

## Sidebar ajustável

- A sidebar abre com os 288 px do canvas e pode ser ajustada arrastando a borda direita (200 a
  640 px), pelas setas do teclado com a borda focada, ou voltar ao padrão com duplo clique. A
  largura é uma conveniência por usuário: fica no `localStorage` do renderer, gravada ao soltar.

## Botão "Descobrir" na Central

- A tela 4 só abria sozinha na primeira vez ou pelo Ctrl+K. A pedido do usuário, o cabeçalho da
  Central ganhou um botão "Descobrir" ao lado do "+ Nova" (só com uma pasta aberta), um desvio
  combinado do canvas.

## Barra de menus

- Sem o menu nativo (removido no Linux/Windows), o Kite ganhou uma barra de menus própria no topo,
  como a do VS Code, só com ações do app: Arquivo (pastas, recentes, salvar, sair), Ver (views,
  barra lateral, tema), Tarefa (nova, trocar, descobrir, revisar, próximo que espera), Terminal
  (novo terminal, novo agente na tarefa, conectar agentes) e Ajuda (documentação, sobre). No
  centro, a pasta e a tarefa abertas. Edição (copiar, colar) fica fora: os atalhos já funcionam
  no editor, nos campos e no terminal.
- Novo atalho `Ctrl/Cmd+B` mostra/oculta a barra lateral (fora do terminal, onde é do shell).

## Página de configurações

- O botão de tema da activity bar virou o botão de **Configurações** (também `Ctrl/Cmd+,` e
  Arquivo → Configurações…), que abre uma página com: Aparência (tema), Idioma, Editor e
  terminal (fonte de cada um, restaurar terminais), Agentes e notificações, Tarefas (agrupamento,
  o mesmo bloco da tela Descobrir), GitHub e Sobre.
- Tudo fica no `settings.json`. Cada campo tem padrão e é validado sozinho (`.catch`): o arquivo
  antigo, só com o tema, continua valendo. O renderer só altera campos conhecidos
  (`settings:update`, schema `strict`); o tema mantém o canal próprio.
- **Idioma:** só português por enquanto. A seção mostra English como "em breve": traduzir exige
  extrair os textos da interface, uma tarefa à parte.
- **Fonte do terminal:** aplicada só com o terminal visível. Escondido, o xterm não mede a fonte nova
  e ficaria com as células antigas. Com DPI 1 o xterm arredonda a célula para pixels inteiros, então
  fontes vizinhas (13 e 12 px) podem dar o mesmo número de colunas.
- **Notificações desligadas** valem para as dos agentes do Kite e as das sessões vistas pelos hooks.
- **Arrasto da sidebar:** segue os eventos da janela em vez da captura do ponteiro (o Chromium às
  vezes perde a captura sem `pointerup`, e a página ficava sem cliques), e o duplo clique é
  detectado no `pointerdown`. Nos e2e, mexer o mouse físico sobre a janela de teste atrapalha os
  testes de arrasto: a janela do Electron é real.

## Janelas sobrepostas

- A pedido do usuário, Configurações, Central de atenção e Conectar agentes deixaram de ser abas e
  abrem numa janela sobreposta dentro do Kite (fundo escurecido; fecha com Esc, no X ou clicando
  fora). Uma tela de cada vez. As ações que levam ao editor, a um terminal ou a uma tarefa (abrir
  arquivo, terminal do agente, abrir tarefa, revisar, retomar aqui) fecham a janela.
- Desvio do canvas (tela 1 mostrava a Central na área principal), combinado com o usuário.
- O app não abre mais a Central sozinho ao iniciar: ela taparia tudo. Com um CLI conectado, abre na
  sidebar da Central. `Ctrl/Cmd+J` vai direto ao terminal de quem espera quando ele roda no Kite;
  senão, mostra o item na Central.

## Interface em inglês e português

- **Sem biblioteca nova.** Um catálogo tipado por área em `src/shared/i18n/messages/`, com o
  português (fonte) e o inglês lado a lado. Um texto é fixo ou uma função dos parâmetros (para
  interpolar e para plural). O TypeScript acusa chave faltando ou parâmetro diferente.
- **Renderer:** `useT()` nos componentes (re-renderizam na troca de idioma) e `t()` nas ações e
  stores. O idioma fica no `settings.json` e em cache no `localStorage`, para a interface já abrir
  no idioma certo. A troca vale na hora; títulos de abas já abertas ficam como estavam.
- **Main:** erros, notificações e o menu do macOS usam o idioma da configuração (`setLanguage`). O
  `kite-hook` não traduz nada (não depende da configuração). Logs continuam em português.
- **Idioma padrão:** o do sistema (`app.getLocale()`): português para `pt-*`, inglês para o resto.
  Os e2e fixam `--lang=pt-BR`.
- **Padrão de pasta:** `{task}` vale o mesmo que `{tarefa}`, para a interface em inglês.
- **Imagens do README** geradas nos dois idiomas (`docs/images/en` e `docs/images/pt-BR`).

## Empacotamento e releases

- **electron-builder** (dependência de desenvolvimento). Linux: AppImage e .deb; Windows: instalador
  NSIS e .zip. As releases saem do GitHub Actions, cada SO na sua máquina, porque o `node-pty` é
  nativo; o workflow anexa tudo a uma release em rascunho.
- **kite-hook no app empacotado:** o script fica fora do asar (`asarUnpack`) e, ao iniciar, é
  copiado para a pasta de perfil (`hook/`). O AppImage é montado num caminho novo a cada execução,
  e os hooks precisam funcionar com o Kite fechado; nele o `kite-hook.sh` chama o próprio arquivo
  `.AppImage` (variável `APPIMAGE`). Verificado: eventos gerados com o Kite fechado aparecem ao
  reabrir.
- **Windows:** gerado pelo CI, ainda não testado numa máquina real. Sem assinatura de código.

## Login no app instalado e recuperação de erros (0.1.1)

- **Client ID embutido no build.** O Device Flow não usa client secret, então o Client ID do OAuth
  App não é segredo. O build o lê de `KITE_GITHUB_CLIENT_ID` (no CI, uma variável do repositório)
  ou do `.env` local e o grava como padrão (`define` do electron-vite). `GITHUB_CLIENT_ID` no
  ambiente ou no `.env` da pasta de perfil vence; definida vazia, desliga o login (os e2e usam).
  Sem backend: o login continua direto entre o app e o GitHub.
- **Erros da interface não deixam mais a janela vazia.** Um `ErrorBoundary` mostra o erro com
  "Recarregar"; se o processo da interface cair, o main registra e recarrega a janela.
- **Log em arquivo** em `logs/main.log` na pasta de perfil (vira `main.log.1` ao passar de 1 MB),
  com os erros da interface também no app instalado. Nunca registra conteúdo de arquivos ou tokens.
- Tela preta ao trocar de pasta na 0.1.0 (Linux, NVIDIA + Wayland/COSMIC): não reproduzida nos
  testes, que simulam o diálogo nativo. Suspeita: composição gráfica do Electron em Wayland com
  NVIDIA depois do diálogo nativo. A 0.1.1 traz o log e a recuperação para confirmar a causa.

## "Para revisar": revisar, sair sozinho e dispensar

- **Toda linha tem "Revisar".** Sessões fora de tarefa (agente rodando direto no repo principal)
  abrem a mesma tela de revisão dos agentes do Kite, com os arquivos que a sessão editou e que
  ainda não foram commitados, comparados com o `HEAD`. Só esses arquivos podem ser lidos por ali:
  o main confere cada pedido de diff contra os arquivos editados pela sessão.
- **Sai sozinha quando não há o que revisar.** Uma sessão encerrada só entra no grupo depois de
  conferida no git (para não piscar ao abrir o Kite) e sai quando tudo o que editou foi commitado
  ou descartado. A conferência roda ao abrir a Central, quando uma sessão muda, ao voltar para a
  janela e a cada 30 s, porque os commits costumam acontecer fora do Kite.
- **"Dispensar" (✕) na linha e no menu de contexto.** Desvio combinado do canvas (o desenho não
  tem esse botão). Dispensas ficam em `review.json` na pasta de perfil, por sessão ou por execução
  de agente do Kite (um agente reiniciado volta a aparecer), e são esquecidas depois de 7 dias.
