# Plano de refatoração

Objetivo: levar o código aos padrões do `AGENTS.md` sem mudar comportamento, priorizando
segurança e as travas que impedem a dívida de voltar. Cada etapa é um ou mais PRs pequenos, todos
com lint, typecheck, unidade e e2e verdes.

## Diagnóstico (2026-10-18)

O ponto de partida é melhor do que parece:

- Lint, typecheck e 270 testes de unidade (51 arquivos) passando; 20+ specs e2e.
- Segurança da janela correta (`contextIsolation`, `sandbox`, sem `nodeIntegration`, CSP
  restritiva, navegação bloqueada, `openExternal` só http/https).
- IPC tipado de ponta a ponta, com zod em todo handler e erros normalizados (`createHandler`).
- `WorkspaceGuard` cobre `..` e symlinks; escrita de JSON atômica; token via `safeStorage`.
- Serviços com dependências injetadas e testados sem Electron.

Os problemas reais:

| #   | Problema                                                                                      | Onde                                                            | Risco                          |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| 1   | Sem CI em PR/push: lint e testes só rodam se alguém lembrar                                   | `.github/workflows` só tem release                              | Alto                           |
| 2   | `pty:create` aceita `env` arbitrário do renderer (`LD_PRELOAD`, `NODE_OPTIONS`, `BASH_ENV`…)  | `ipc/terminal.ipc.ts:20`                                        | Médio (defesa em profundidade) |
| 3   | Handlers IPC não verificam a origem (`event.senderFrame`)                                     | `ipc/register.ts`                                               | Médio                          |
| 4   | Validação de branch duplicada em 3 lugares                                                    | `git.service`, `task.service`, `task-review.service`            | Médio                          |
| 5   | `main/index.ts` com 606 linhas: janela, notificações, hook, composição e ciclo de vida juntos | `main/index.ts`                                                 | Manutenção                     |
| 6   | Serviços grandes                                                                              | `git.service` 591, `task.service` 569, `agent.service` 422      | Manutenção                     |
| 7   | `shared/types.ts` com 489 linhas, todos os domínios                                           | `shared/types.ts`                                               | Manutenção                     |
| 8   | 30 `.catch(() => …)` que engolem erro sem log                                                 | main e renderer                                                 | Diagnóstico                    |
| 9   | 9 `eslint-disable react-hooks/exhaustive-deps`                                                | renderer                                                        | Bugs de estado                 |
| 10  | `window.api` chamado direto em 10 componentes                                                 | renderer                                                        | Acoplamento                    |
| 11  | Componentes grandes                                                                           | `SettingsPanel` 510, `TaskReviewPanel` 353, `DiscoverPanel` 308 | Manutenção                     |
| 12  | Cobertura do renderer baixa: 15 testes para 134 arquivos                                      | renderer                                                        | Regressões                     |
| 13  | Mensagem `EACCES` fixa em português, fora do i18n                                             | `ipc/handle.ts`                                                 | Baixo                          |

## Etapas

### R0 — Travas (primeiro, porque protege todo o resto)

- [x] Workflow `ci.yml` em push/PR: `pnpm install --frozen-lockfile`, lint, typecheck, test.
      e2e num job separado em Linux com `xvfb-run`.
- [x] ESLint: `no-restricted-imports` impedindo `electron` em `main/services` e `main/lib`, e
      `main`/`preload` dentro do `renderer`.
- [x] ESLint: `react-hooks/exhaustive-deps` como `error`; `no-console` no main.
- [x] Cobertura no Vitest (`@vitest/coverage-v8`) só para medir a linha de base, sem meta ainda.
- [x] `pnpm audit --prod` no CI, falhando só em severidade alta ou crítica.

**Aceite:** um PR com lint quebrado fica vermelho. As regras novas podem entrar com a lista de
violações atuais ignoradas por arquivo, removidas nas etapas seguintes.

### R1 — Segurança

- [x] `dompurify` (via Monaco): não se aplica (Monaco embute a própria cópia e ninguém usa
      `IN_PLACE`); rever ao atualizar o Monaco.
- [x] `pty:create` sem `env`: o campo saiu do contrato (nenhuma tela usava). Teste com
      `LD_PRELOAD`, `NODE_OPTIONS`, `ELECTRON_RUN_AS_NODE`.
- [x] `registerHandler` recusa chamadas cujo `senderFrame.url` não seja o do bundle do renderer.
- [x] `lib/git-refs.ts` com uma única `assertBranchName`; os três serviços passam a usá-la.
      Teste com nomes começando em `-`, `..`, espaços, `@{`.
- [x] Revisar os outros canais que recebem string livre (`agent:savePresets`, `task:*`,
      `github:*`): limites zod e o que cada um permite executar. Registrar o modelo de ameaça
      dos presets (comando do usuário roda no shell de propósito) em `decisions.md`.
- [x] Fuses do Electron no empacotamento (`@electron/fuses`): desligar o que não é usado.
      `RunAsNode` precisa continuar ligado por causa do `kite-hook`; documentar.
- [x] `EACCES` no i18n (e erros do sistema traduzidos no idioma atual).

**Aceite:** testes novos com entradas maliciosas passando; e2e verde.

### R2 — Composição do main

- [x] `main/app/main-window.ts` (criação e eventos da janela), `native-theme.ts`, `profile.ts`,
      `register-ipc.ts`.
- [x] `main/app/notifications.ts` (`notifyAgent`, `notifySession`).
- [x] `main/app/hook-bundle.ts`.
- [x] `main/app/container.ts` (`createServices`) e `main/app/lifecycle.ts` (dispose no fechamento:
      um único `disposeAll()` em vez da lista no `closed`).
- [x] `main/index.ts` fica só com bootstrap (< 80 linhas).

- [ ] **macOS:** ao fechar a janela e reabrir pelo Dock, os serviços encerrados no `closed`
      (watchers, spool de agentes, ticker) não são reiniciados. Bug anterior à refatoração;
      corrigir com teste em macOS.

**Aceite:** `index.ts` só orquestra; e2e de fechar/reabrir (`phase2`, `recovery`) verdes.

### R3 — Serviços e tipos

- [x] Dividir `git.service.ts`: revisão contra a base em `GitReviewService` (fachada no
      `GitService`), execução em `lib/git-exec.ts`. 591 → 361 linhas.
- [x] `task.service.ts`: ajustes em `lib/task-config.ts` (funções puras), worktrees em
      `lib/task-worktrees.ts` (569 → 386). `agent.service.ts`: presets e restauração em
      `lib/agent-state.ts` (422 → 394).
- [x] `shared/types.ts` → `shared/types/<dominio>.ts` com um `index.ts` que reexporta.
- [x] `.catch` silenciosos revisados: sondagens ficam; ações de melhor esforço ganharam
      comentário; a busca de PR na revisão passou a logar. Regra refinada no `AGENTS.md`.

- [ ] Migrar os chamadores dos métodos de revisão para depender do `GitReviewService` direto e
      tirar a fachada (opcional; mexe em deps e testes de 3 serviços).

**Aceite:** nenhum arquivo de serviço acima de 400 linhas; testes existentes intactos.

### R4 — Renderer

- [ ] Helpers usados por várias features (`explorer/FileIcon`, `git/git-format`,
      `editor/language`, `editor/monaco-setup`, `agents/session-format`, `tasks/task-links`…)
      vão para `components/` ou `lib/`; depois, regra de lint que impede importar arquivos
      internos de outra feature (34 imports em 2026-10-18).
- [ ] Tirar `window.api` dos 10 componentes para `*.actions.ts`/`use-*.ts`.
- [ ] Eliminar os 9 `eslint-disable exhaustive-deps` (`useEffectEvent`, refs, actions).
- [ ] Quebrar `SettingsPanel` (uma seção por arquivo), `TaskReviewPanel` e `DiscoverPanel`.
- [ ] Padronizar onde ficam os stores (globais em `stores/`, de feature na feature).

**Aceite:** `grep window.api` em `.tsx` vazio (exceto `ErrorBoundary`, se justificado); lint sem
`eslint-disable` de hooks.

### R5 — Testes

Linha de base de cobertura de linhas (R0, 2026-10-18): total 36,6%; `main/services` 91,5%,
`main/lib` 93,1%, `main/ipc` 9,1%, `main/index.ts` 0%, renderer 9,3%.

- [ ] Testes de stores e actions do renderer (attention, tasks, editor, terminal), com
      `window.api` falso.
- [ ] Teste de contrato: todo canal de `InvokeChannels` tem handler registrado e função no
      preload.
- [ ] Definir meta de cobertura a partir da linha de base do R0 (ex.: main ≥ 80%, lib ≥ 90%).

### R6 — Documentação

- [x] `AGENTS.md` reescrito como definição do projeto e padrões; `CLAUDE.md` importa ele.
- [ ] `CONTRIBUTING.md` e `README` refletem a estrutura nova (`main/app/`, `shared/types/`).
- [ ] Decisões do caminho registradas em `docs/decisions.md`.

## Ordem e paralelismo

R0 → R1 são sequenciais e vêm antes de tudo. R2 e R3 podem andar juntos (arquivos diferentes).
R4 depende só do R0. R5 acompanha R3/R4 (cada divisão já traz seus testes). R6 fecha.

Feature nova durante a refatoração: pode, mas já no padrão novo e em PR separado.
