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
