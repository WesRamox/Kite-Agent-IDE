# AGENTS.md — Kite

Definição do projeto e padrões de código. Vale para qualquer pessoa ou agente (Claude Code, Codex,
Gemini, opencode) que mexa neste repositório. Leia antes de escrever código.

Documentos relacionados:

- `docs/decisions.md`: decisões já tomadas e o motivo de cada uma. Consulte antes de "corrigir"
  algo que parece estranho.
- `docs/refactor-plan.md`: refatoração em andamento, em etapas.
- `CONTRIBUTING.md`: setup, variáveis de ambiente, releases e traduções.

---

## 1. O que é o Kite

IDE desktop (macOS, Windows, Linux) para quem trabalha **com agentes de IA de linha de comando**
(Claude Code, Codex, Gemini CLI, opencode) em várias tarefas ao mesmo tempo, cada uma mexendo em
vários repositórios. Inspirado no Orca (https://github.com/stablyai/orca).

O problema que resolve: com vários agentes em paralelo, a pessoa perde o controle de qual está
esperando resposta e precisa abrir uma janela de editor por worktree. O Kite junta numa janela só
os arquivos, terminais, Git e GitHub de cada tarefa, e mostra quem precisa de atenção.

### Conceitos

| Conceito | Definição |
|---|---|
| **Workspace** | Pasta aberta no Kite. Pode ser um repo ou uma pasta com vários repos (detectados até 2 níveis), mais repos de outras pastas adicionados à mão. |
| **Tarefa** | Grupo de worktrees de repos diferentes que formam uma unidade de trabalho (ex.: `PAY-412` em `api` e `web`). |
| **Sessão** | Um agente rodando, dentro de um terminal do Kite ou fora dele, ligado a uma tarefa. |
| **Preset de agente** | Comando configurável que inicia um CLI de agente (`claude`, `codex`, `gemini`, `opencode` ou customizado). |

### Princípios do produto

- **O Kite observa, não exige.** Worktrees criadas por scripts, skills ou à mão, e agentes abertos
  em terminais externos, funcionam igual aos criados pelo Kite.
- **Nada específico de empresa ou layout de pastas.** Agrupamento por heurísticas genéricas, com
  padrão configurável; o ajuste manual do usuário sempre vence a heurística.
- **Nunca atrapalhar o agente.** A integração (hooks) não bloqueia, não altera o comportamento do
  CLI e, em erro, simplesmente não reporta.
- **Privacidade local.** Mensagens de agente e conteúdo de arquivos nunca saem da máquina nem vão
  para log; guarda-se só caminhos e um trecho da última mensagem.

### Capacidades

- **Arquivos:** árvore virtualizada (ignora `.git`, `node_modules`, `dist`, `build`, `.next` e
  respeita `.gitignore`), Monaco com abas, quick open fuzzy, watcher com recarga ou pergunta
  quando há alterações locais. Binários e arquivos acima de 5 MB não abrem no editor.
- **Terminais:** PTYs reais com o shell do SO, abas e splits (dockview), WebGL com fallback,
  busca, links, scrollback persistido. Nenhum processo órfão ao fechar.
- **Git:** status na árvore, diff no Monaco, stage, commit, branches e worktrees (padrão
  `../<repo>-worktrees/<branch>`).
- **GitHub:** login por OAuth Device Flow (`GITHUB_CLIENT_ID`), PRs, issues, checks, abrir PR em
  worktree, criar PR. Suporta GitHub Enterprise.
- **Tarefas multi-repo:** descoberta por `git worktree list --porcelain`, agrupada por (1) pasta
  pai comum que não é repo, (2) mesmo nome de branch ignorando prefixos (`feat/`, `fix/`), (3)
  padrão `{tarefa}`/`{repo}` configurável, (4) manual. Ajustes em `userData/tasks.json`. Título
  opcional por `TASK.md`/`.kite-task.json`.
- **Central de atenção:** grupos *Esperando você* (ordenado por tempo), *Trabalhando*, *Para
  revisar* e *Sem tarefa*; responder, retomar (`claude --resume`), abrir tarefa, revisar.
- **Revisão e entrega:** diff por repo contra o merge-base da branch base, commit por repo ou em
  lote, push e PRs com links cruzados entre os repos da mesma tarefa.

---

## 2. Stack

| Área | Escolha |
|---|---|
| Runtime | Electron |
| Linguagem | TypeScript `strict` + `noUncheckedIndexedAccess` |
| Build | `electron-vite` |
| UI | React 19, Zustand, Tailwind CSS v4 |
| Editor | `monaco-editor` via `@monaco-editor/react` |
| Terminal | `@xterm/xterm` (+ addons fit, webgl, search, serialize, web-links) e `node-pty` |
| Layout / árvore | `dockview-react`, `react-arborist` |
| Watcher | `@parcel/watcher` |
| Git / GitHub | `simple-git`, `@octokit/rest` |
| Validação | `zod` |
| Ícones / fontes | `lucide-react`, Geist e Geist Mono locais |
| Testes | Vitest (unidade), Playwright (e2e do Electron) |
| Qualidade | ESLint, Prettier |
| Pacotes | pnpm (`nodeLinker: hoisted`) |

Não troque nem adicione dependência de runtime sem perguntar. Versões fixadas por
compatibilidade estão explicadas em `docs/decisions.md`.

---

## 3. Arquitetura

```
┌─────────────── Renderer (React, sandbox) ───────────────┐
│ features/: explorer, editor, terminal, git, github,      │
│            agents, tasks, quick-open, settings           │
└──────────────────────────┬───────────────────────────────┘
                           │ window.api (preload, contextBridge)
                           │ contrato tipado em shared/ipc-contract.ts
┌──────────────────────────┴── Main (Node) ────────────────┐
│ ipc/        valida (zod) e delega                        │
│ services/   regras de negócio, deps injetadas            │
│ lib/        funções puras e utilitários                  │
│ hook/       kite-hook, chamado pelos CLIs de agente      │
└──────────────────────────────────────────────────────────┘
```

### Direção das dependências

```
renderer ──(window.api)──▶ preload ──(IPC)──▶ main/ipc ──▶ main/services ──▶ main/lib
    └──────────────── todos podem importar ────────────────▶ shared
```

- `shared/` não importa de `main`, `preload` ou `renderer`, nem Node, Electron ou DOM.
- `main/services/` e `main/lib/` **não importam `electron`**. `dialog`, `shell`, `safeStorage`,
  `BrowserWindow` e `Notification` entram por injeção de dependência.
- Só `main/index.ts`, `main/app/*` (composição, janela, notificações), `main/menu.ts` e
  `main/ipc/register.ts` falam com o Electron diretamente.
- `renderer/` só importa de `shared/` e de si mesmo.
- Uma feature do renderer não importa arquivos internos de outra, só `*.actions.ts`,
  `*.store.ts` e `use-*.ts` expostos de propósito. Componente compartilhado vai para
  `components/`.

### Estrutura de pastas

```
src/
  main/
    index.ts            # bootstrap do app
    app/                # composição dos serviços, janela, notificações, ciclo de vida
    ipc/                # <dominio>.ipc.ts, handle.ts, register.ts, schemas.ts
    services/           # <dominio>.service.ts (+ .test.ts)
    lib/                # funções puras, guard, logger, stores JSON
    hook/               # kite-hook.ts
  preload/index.ts      # window.api
  shared/
    ipc-contract.ts     # todos os canais IPC (fonte única)
    types/              # tipos por domínio
    i18n/messages/      # catálogos pt-BR + en por área
    themes.ts, settings.ts
  renderer/src/
    app/                # layout raiz, providers
    features/<feature>/ # UI, hooks, actions e store de cada área
    stores/             # estado global (layout, tema, toasts, modal, contexto)
    components/         # UI genérica
    lib/                # utilitários do renderer
e2e/                    # specs Playwright
docs/                   # decisões, plano de refatoração, guia
```

`shared/types/` é destino da refatoração (ver `docs/refactor-plan.md`); enquanto não existir,
os tipos estão em `shared/types.ts`.

---

## 4. Padrões do main process

### Serviços

- Uma classe por domínio, `export interface <Nome>ServiceDeps` e
  `constructor(private readonly deps: <Nome>ServiceDeps)`.
- Deps são interfaces mínimas (só os métodos usados). Testável sem Electron, sem rede.
- Sem estado global de módulo. Timers, watchers e PTYs são liberados no fechamento
  (`dispose()`/`killAll()`).
- Lógica pura (parse, agrupamento, montagem de comando) vai para `lib/`, testada sem mocks.
- ~300 linhas por arquivo. Acima de 400, divida por responsabilidade antes de acrescentar.

### IPC

Canal novo, nesta ordem:

1. Tipo em `shared/ipc-contract.ts` (`InvokeChannels` e `Api`). Nome `dominio:acao` para
   request/response e `dominio:evento` para eventos do main.
2. Handler em `main/ipc/<dominio>.ipc.ts`: `registerHandler(canal, z.tuple([...]), fn, log)`.
3. Função nomeada em `preload/index.ts`.

- O handler só valida e delega; nenhuma regra de negócio em `.ipc.ts`.
- Todo argumento do renderer é hostil: zod com limites (`max` em strings e arrays). Schemas
  reaproveitáveis (`absPath` etc.) ficam em `ipc/schemas.ts`.
- Validação de domínio (branch, ref, URL, shell) numa função única em `lib/`, chamada pelo
  serviço. Não duplique regex de validação.
- Eventos para o renderer só pelo `emit()` tipado.

### Erros

- Erro esperado: `throw new AppException(code, t('error.xxx'))`. O `createHandler` devolve
  `{ ok: false, error: { code, message } }`; erro inesperado vira `INTERNAL` sem detalhes para o
  renderer, com detalhes no log do main.
- Proibido engolir erro em silêncio. `.catch(() => {})` ou `catch {}` só com comentário dizendo
  por que é seguro, e com `log.warn`/`log.debug` quando a falha ajudar a diagnosticar.
- `err as Error` só depois de `err instanceof Error`; senão, `String(err)`.

### Logs

- Sempre pelo `logger` (`log.child('<area>')`), com níveis `debug`, `info`, `warn`, `error`.
  Nunca `console.*` no main.
- Logue ids, códigos, contagens e caminhos. **Nunca** conteúdo de arquivo, prompts, mensagens de
  agente, tokens, valores do `.env` ou cabeçalhos HTTP.

---

## 5. Segurança (inegociável)

- `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`. Navegação para fora do bundle bloqueada; janelas novas negadas.
- O preload expõe só funções nomeadas do contrato. Nunca `ipcRenderer`, `fs`, `child_process`,
  `shell` ou um `invoke(canal)` genérico.
- **Arquivos:** todo caminho vindo do renderer passa pelo `WorkspaceGuard`: `resolveExisting`
  para ler e escrever, `resolveEntry` para criar, renomear e excluir. Fora das raízes abertas
  (inclusive via `..` e symlinks) é recusado. A raiz não pode ser renomeada nem excluída; excluir
  move para a lixeira. Métodos internos sem guarda (`spawnAt` etc.) nunca recebem caminho cru do
  renderer.
- **Processos:** nunca monte linha de comando concatenando dado externo. Use array de argumentos;
  quando o shell for inevitável, `shQuote`/`psQuote` (`lib/agent-command.ts`). Argumento de git
  vindo de fora não pode começar com `-`; use `--` antes de paths.
- **Ambiente:** o renderer não define variáveis de ambiente de processos. Se um dia precisar,
  só por allowlist (nunca `LD_PRELOAD`, `NODE_OPTIONS`, `ELECTRON_RUN_AS_NODE`, `BASH_ENV` etc.).
- **Origem do IPC:** `registerHandler` só atende o `index.html` do renderer (ou o Vite em dev).
- **Fuses do Electron** (`electron-builder.yml`): `NODE_OPTIONS` e `--inspect` desligados no app
  empacotado; `RunAsNode` ligado por causa do `kite-hook`.
- `shell.openExternal` só com `http:`/`https:` validado.
- **Segredos:** token do GitHub só via `TokenStore` (`safeStorage`). Nunca em JSON de perfil,
  `localStorage` ou log.
- **CSP** restritiva no `renderer/index.html`. Sem `unsafe-eval`, CDN ou host novo sem decisão
  registrada.
- **Arquivos de terceiros** (`~/.claude/settings.json`, hooks do Codex e Gemini): merge que
  preserva o resto, idempotente, com backup e prévia, só com confirmação. Remover a integração
  devolve o arquivo ao original.

---

## 6. Padrões do renderer

### Organização de uma feature

```
features/<feature>/
  <Componente>.tsx       # UI: recebe dados e callbacks, quase sem lógica
  use-<algo>.ts          # hooks: assinaturas de eventos, dados derivados
  <feature>.actions.ts   # chamam window.api, atualizam stores, mostram toasts
  <feature>.store.ts     # estado Zustand da feature
  <feature>.ts           # lógica pura e testável
```

- **Componentes não chamam `window.api`.** Isso fica em `*.actions.ts` ou `use-*.ts`, usando
  `attempt()` (`lib/ipc.ts`), que transforma `{ ok: false }` em toast amigável.
- Estado global (layout, tema, toasts, modal) em `stores/`; estado de uma feature, nela.
- Seletores finos do Zustand (`useStore((s) => s.campo)`), nunca o store inteiro.
- Componente com mais de ~200 linhas ou mais de um `useEffect` de dados: extraia hook ou
  subcomponente.
- `eslint-disable` de `react-hooks/exhaustive-deps` é proibido. Use `useEffectEvent`, ref estável
  ou mova a lógica para uma action.

### Interface

```
┌────┬──────────────┬──────────────────────────────────┐
│ A  │  Sidebar     │  Barra de ações                  │
│ c  │  Central     ├──────────────────────────────────┤
│ t  │  Explorer    │  Área principal (dockview):      │
│ i  │  Git         │  editores, diffs, terminais,     │
│ v  │  GitHub      │  revisão, em abas e splits       │
│ .  │  Config.     │                                  │
├────┴──────────────┴──────────────────────────────────┤
│ Status bar: branch, worktree, agentes esperando…     │
└──────────────────────────────────────────────────────┘
```

- Janela sem moldura do sistema: a barra de menus do Kite arrasta e tem os botões da janela
  (no macOS, botões nativos embutidos).
- **Telas multi-repo seguem o canvas aprovado à risca**: "Kite — Tarefas multi-repo"
  (https://claude.ai/artifact/Ebc9UREpgS9uAxuwZ9fbTu). Mesma estrutura, ordem, tamanhos,
  espaçamentos, raios, pesos, textos e estados. Antes de mexer numa tela, leia o
  `project/<Tela>.dc.html` dela. Os dados do canvas são só ilustração. Qualquer desvio é
  combinado antes e registrado em `docs/decisions.md`.
- Cores só por tokens do tema (`surface-*`, `border`, `fg`, `fg-muted`, `accent`, `accent-fg`,
  `info`, `success`, `danger`), para todos os temas (`kite`, `dark`, `midnight`, `dimmed`,
  `light`, `paper`) funcionarem. Nada de hex ou cor do Tailwind solta.
- Fontes Geist e Geist Mono empacotadas localmente; ícones de `lucide-react`.
- **i18n:** todo texto visível passa por `t()`, com chave nos catálogos de
  `shared/i18n/messages/` em pt-BR (fonte) e en.

### Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl/Cmd+S` | Salvar |
| `Ctrl/Cmd+P` | Quick open |
| `` Ctrl/Cmd+` `` | Abrir terminal |
| `Ctrl/Cmd+W` | Fechar aba |
| `Ctrl/Cmd+J` | Próxima sessão esperando |
| `Ctrl/Cmd+K` | Trocar de tarefa (guarda abas e terminais de cada uma) |

Atalho novo não pode colidir com estes nem com os do Monaco e do terminal.

---

## 7. Integração com agentes

- **`kite-hook`** (`main/hook/`): executado pelo binário do Electron com
  `ELECTRON_RUN_AS_NODE=1` (sem depender de Node instalado). Lê o JSON do hook no stdin, acrescenta
  uma linha em `userData/agent-events/<session_id>.jsonl` e sai com código 0 em **menos de
  100 ms**. Nunca bloqueia; em erro, só sai. Inclui `KITE_AGENT_ID`/`KITE_PTY_ID` quando o agente
  roda num PTY do Kite.
- **Eventos** são validados com zod; evento desconhecido é ignorado. O estado das sessões é
  reconstruído do spool ao abrir o Kite.
- **Status:** `UserPromptSubmit`/`PreToolUse`/`PostToolUse` → `running`; `Notification` →
  `waiting` (com o pedido); `Stop` → `waiting` ("sua vez", com a última mensagem da transcrição);
  `SessionEnd` → `ended`. Para CLIs sem hooks, a heurística do terminal (saída recente, exit
  code) é o fallback, isolada no seu módulo.
- Adaptador de CLI novo implementa a mesma interface de eventos e usa a mesma tela de conectar.
- Ligação sessão ↔ tarefa: cwd dentro de uma worktree da tarefa; senão, a tarefa da maioria dos
  arquivos tocados; senão, manual. A escolha manual vence.

---

## 8. TypeScript e estilo

- Sem `any`; use `unknown` e valide. Dado externo (IPC, JSON, arquivo, rede, stdin) sempre por
  `schema.parse`/`safeParse`.
- `as` só para estreitar algo já verificado ou em `as const`. Cast para "fazer compilar" é bug.
- Tipos compartilhados em `shared/`, por domínio; tipo usado só de um lado fica nele.
- Prefira união discriminada a combinações de flags booleanas.
- Identificadores em inglês; comentários, logs, commits e docs em português.
- Comentário explica o **porquê**, não o quê.
- Arquivos em `kebab-case`; componentes React em `PascalCase.tsx`; testes `x.test.ts` ao lado
  de `x.ts`.
- Prettier formata (exceto este arquivo). Siga o idioma do código vizinho antes de inventar.

---

## 9. Testes

- Todo serviço e função de `lib/` novos ganham teste unitário; bug corrigido ganha teste que
  falhava antes.
- Serviços com deps falsas. Git com repositório temporário real quando o comportamento do git
  importa.
- Teste descreve comportamento ("recusa caminho fora da raiz via symlink"), não implementação.
- Toda validação de segurança (guard, schemas, quoting, merge de hooks, env) tem teste com a
  entrada maliciosa.
- e2e com Playwright dirigindo o app construído, perfil temporário (`KITE_USER_DATA_DIR`) e
  arquivos de hook isolados (`KITE_CLAUDE_SETTINGS` etc.). Nunca toca o perfil real.

---

## 10. Como trabalhar

### Comandos

```bash
pnpm dev          # app com HMR
pnpm lint         # ESLint
pnpm typecheck    # tsc de main/preload, renderer e e2e
pnpm test         # Vitest
pnpm test:e2e     # build + Playwright
pnpm format       # Prettier
```

### Definição de pronto

1. `pnpm lint && pnpm typecheck && pnpm test` passam, sem warnings novos.
2. Testes conforme a seção 9.
3. Mudou fluxo visível (tela, atalho, IPC usado por tela)? Rode o spec e2e da área.
4. Textos novos no i18n, em pt-BR e en.
5. Decisão não óbvia registrada em `docs/decisions.md`.
6. `README.md`/`CONTRIBUTING.md` atualizados se mudou setup, script ou variável de ambiente.

Não diga que algo está pronto sem ter rodado os comandos. O que não pôde ser verificado (outro
SO, app empacotado) é dito explicitamente.

### Decisões

- Difícil de desfazer, troca de stack, desvio do canvas ou dos princípios do produto: pergunte
  antes.
- Fácil de desfazer e não coberta aqui: decida, siga e registre em `docs/decisions.md`.

### Git

- Conventional Commits em português: `feat(git): ...`, `fix(pty): ...`, `refactor(main): ...`.
- Um commit, uma intenção. Refatoração não muda comportamento nem vem junto com feature.
- Commit ou push só quando pedido.

### Refatoração

- Comportamento preservado: testes existentes passam sem mudar expectativa. Mudar expectativa é
  mudança de comportamento e vai em commit separado.
- Passos pequenos e verdes. Mova antes de mudar.
- Siga a ordem de `docs/refactor-plan.md` e marque os itens concluídos.

### Multiplataforma

Teste no SO em que estiver rodando e sinalize o que depende de outro. Pendências conhecidas:
caminho e aspas do comando do hook no Windows, `ELECTRON_RUN_AS_NODE` no app empacotado do macOS
e permissões do spool.

---

## 11. Fora do escopo (por enquanto)

Não implemente sem combinar, mas não feche portas na arquitetura: navegador embutido/design mode,
SSH e worktrees remotas, app mobile, integração com Linear ou outro gerenciador de tarefas,
comentários em diff enviados ao agente, sistema de extensões, LSP.
