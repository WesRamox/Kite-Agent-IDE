# AGENTS.md — IDE de IA (MVP)

> Este arquivo é o ponto de partida para o agente de IA que vai construir o projeto.
> Leia tudo antes de escrever código. Siga as fases **em ordem** e não avance sem cumprir os critérios de aceite da fase atual.

---

## 1. Visão do produto

Uma IDE desktop focada em trabalhar **com agentes de IA** (Claude Code, Codex, Gemini CLI etc.), inspirada no Orca (https://www.onorca.dev, código em https://github.com/stablyai/orca).

O MVP precisa de:

1. **Arquivos**: abrir uma pasta, navegar na árvore, abrir, editar e salvar arquivos.
2. **Terminais**: vários terminais reais (PTY) com splits.
3. **Git**: status, diff, commit, branches e **worktrees**.
4. **GitHub**: login, listar PRs e issues, criar worktree a partir de PR, abrir PR.
5. **Agentes**: rodar um CLI de agente dentro de uma worktree isolada, cada um no seu terminal.

Plataformas: macOS, Windows e Linux.

---

## 2. Stack (obrigatória)

| Área | Escolha |
|---|---|
| Runtime | Electron (versão estável mais recente) |
| Linguagem | TypeScript em modo `strict` em todo o projeto |
| Build | `electron-vite` |
| UI | React 18+ |
| Estado | Zustand |
| Estilo | Tailwind CSS, tema escuro como padrão |
| Editor | `monaco-editor` (via `@monaco-editor/react`) |
| Terminal (UI) | `@xterm/xterm` + `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/addon-search`, `@xterm/addon-serialize`, `@xterm/addon-web-links` |
| Terminal (processo) | `node-pty` |
| File watcher | `@parcel/watcher` |
| Árvore de arquivos | `react-arborist` (virtualizada) |
| Layout / splits | `dockview` |
| Git | `simple-git` |
| GitHub | `@octokit/rest` + OAuth Device Flow |
| Segredos | `safeStorage` do Electron |
| Testes | Vitest (unidade) e Playwright (e2e do Electron) |
| Lint/format | ESLint + Prettier |
| Pacotes | pnpm |

Não troque nenhuma dessas escolhas sem perguntar antes.

---

## 3. Arquitetura

```
┌─────────────── Renderer (React) ───────────────┐
│ FileTree │ Editor (Monaco) │ Terminal (xterm)  │
│ GitPanel │ GitHubPanel     │ AgentsPanel       │
└──────────────────┬─────────────────────────────┘
                   │ IPC tipado via preload (contextBridge)
┌──────────────────┴── Main (Node) ──────────────┐
│ FsService      leitura, escrita, watcher       │
│ PtyManager     cria/mata PTYs, resize, I/O     │
│ GitService     status, diff, commit, worktree  │
│ GitHubService  Octokit + token criptografado   │
│ AgentService   roda CLIs de agente em PTYs     │
└────────────────────────────────────────────────┘
```

### Estrutura de pastas

```
src/
  main/
    index.ts              # cria a janela, registra handlers IPC
    ipc/                  # um arquivo de handlers por serviço
    services/
      fs.service.ts
      pty.service.ts
      git.service.ts
      github.service.ts
      agent.service.ts
    lib/                  # utilitários (paths, logger, validação)
  preload/
    index.ts              # expõe window.api com funções específicas
  shared/
    ipc-contract.ts       # tipos de TODOS os canais IPC (fonte única)
    types.ts
  renderer/
    src/
      app/                # layout raiz, providers
      features/
        explorer/
        editor/
        terminal/
        git/
        github/
        agents/
      stores/             # stores Zustand
      components/         # UI genérica
      lib/
```

### Regras de segurança (inegociáveis)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` no renderer.
- O preload expõe **apenas funções nomeadas** definidas em `shared/ipc-contract.ts`. Nunca exponha `fs`, `child_process`, `ipcRenderer` ou `shell` inteiros.
- Todo handler IPC no main **valida os argumentos** (use `zod`).
- Operações de arquivo só podem acontecer **dentro das pastas abertas pelo usuário** (workspace roots). Rejeite paths fora delas, inclusive via `..` e symlinks.
- Token do GitHub criptografado com `safeStorage`. Nunca em texto puro, nunca em log.
- CSP restritiva no `index.html` do renderer.

### Contrato IPC

Todos os canais ficam tipados em `src/shared/ipc-contract.ts`. Padrão:

- Request/response: `ipcMain.handle` / `ipcRenderer.invoke`, nomes no formato `dominio:acao` (ex.: `fs:readFile`).
- Eventos do main para o renderer (saída de PTY, mudanças em arquivos): `webContents.send`, nomes no formato `dominio:evento` (ex.: `pty:data`, `fs:changed`).

Canais mínimos:

```ts
// fs
'fs:openFolderDialog'  () => string | null
'fs:readDir'           (path) => DirEntry[]
'fs:readFile'          (path) => { content: string; encoding: string }
'fs:writeFile'         (path, content) => void
'fs:create' | 'fs:rename' | 'fs:delete'
'fs:watch' / 'fs:unwatch'
event 'fs:changed'     { root, events: { type, path }[] }

// pty
'pty:create'           ({ cwd, shell?, cols, rows, env? }) => { id }
'pty:write'            (id, data) => void
'pty:resize'           (id, cols, rows) => void
'pty:kill'             (id) => void
event 'pty:data'       { id, data }
event 'pty:exit'       { id, exitCode }

// git
'git:status' | 'git:diff' | 'git:stage' | 'git:unstage' | 'git:commit'
'git:branches' | 'git:checkout'
'git:worktreeList' | 'git:worktreeAdd' | 'git:worktreeRemove'

// github
'github:startDeviceFlow' | 'github:pollDeviceFlow' | 'github:logout' | 'github:me'
'github:listPRs' | 'github:listIssues' | 'github:getPR' | 'github:createPR'

// agents
'agent:list' | 'agent:start' | 'agent:stop'
event 'agent:status'   { id, status: 'running' | 'waiting' | 'done' | 'error' }
```

---

## 4. Layout da interface

```
┌────┬──────────────┬──────────────────────────────────┐
│ A  │  Sidebar     │  Área principal (dockview)        │
│ c  │  (troca pelo │  ┌──────────────┬───────────────┐ │
│ t  │  activity    │  │ Editor/abas  │ Editor/abas   │ │
│ i  │  bar):       │  ├──────────────┴───────────────┤ │
│ v  │  Explorer    │  │ Terminais (abas + splits)    │ │
│ i  │  Git         │  └──────────────────────────────┘ │
│ t  │  GitHub      │                                   │
│ y  │  Agents      │                                   │
├────┴──────────────┴──────────────────────────────────┤
│ Status bar: branch, worktree, nº de agentes, linha/col │
└───────────────────────────────────────────────────────┘
```

Atalhos mínimos: `Ctrl/Cmd+S` salvar, `Ctrl/Cmd+P` quick open, `Ctrl/Cmd+`` ` abrir terminal, `Ctrl/Cmd+W` fechar aba, `Ctrl/Cmd+Shift+F` busca no projeto (fase futura).

---

## 5. Fases e critérios de aceite

Ao terminar cada fase: rode lint, typecheck e testes, faça um commit `feat(fase-N): ...` e resuma o que foi feito antes de seguir.

### Fase 0 — Fundação
- Projeto com `electron-vite` + React + TS strict + Tailwind + ESLint/Prettier.
- `@electron/rebuild` configurado para `node-pty` (script `postinstall`).
- `shared/ipc-contract.ts` e preload tipado.
- Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

**Aceite:** `pnpm install && pnpm dev` abre a janela com o layout vazio (activity bar, sidebar, área principal, status bar).

### Fase 1 — Arquivos e editor
- Abrir pasta pelo diálogo nativo; lembrar as pastas recentes.
- Árvore virtualizada com ícones, expandir/recolher, criar, renomear e excluir (com confirmação).
- Ignorar `.git`, `node_modules`, `dist`, `build`, `.next` por padrão e respeitar `.gitignore`.
- Watcher atualiza a árvore quando arquivos mudam fora da IDE.
- Monaco com abas, indicador de "não salvo", detecção de linguagem pela extensão, `Ctrl+S`.
- Se o arquivo mudar no disco com a aba aberta e sem alterações locais, recarregar; se houver alterações locais, perguntar.
- Quick open (`Ctrl+P`) com busca fuzzy nos nomes de arquivo.
- Arquivos binários e muito grandes (> 5 MB) não abrem no editor; mostrar aviso.

**Aceite:** abrir um repo real (ex.: este próprio), editar e salvar arquivos, e ver mudanças externas refletidas sem travar a UI.

### Fase 2 — Terminais
- Criar vários terminais com o shell padrão do SO (`$SHELL`, ou `pwsh`/`powershell` no Windows), com `cwd` na pasta aberta.
- Abas e splits horizontais/verticais pelo dockview.
- Resize sincronizado (`addon-fit` → `pty:resize`), com debounce.
- Renderização WebGL, com fallback para canvas se falhar.
- Busca no scrollback, links clicáveis, copiar/colar.
- Persistir o scrollback (`addon-serialize`) ao fechar e restaurar ao reabrir.
- Matar todos os PTYs ao fechar a janela (nada de processos órfãos).

**Aceite:** rodar `pnpm dev` de outro projeto num terminal, abrir 4 terminais em split, redimensionar sem quebrar o layout do texto, fechar e reabrir mantendo o histórico.

### Fase 3 — Git local
- Status com cores na árvore (modificado, novo, removido) e painel Git com listas de staged e unstaged.
- Clicar num arquivo abre o **diff editor** do Monaco.
- Stage/unstage por arquivo, commit com mensagem, troca e criação de branch.
- Worktrees: listar, criar (`git worktree add`) numa pasta irmã padrão (`../<repo>-worktrees/<branch>`), remover e abrir uma worktree como workspace.
- Branch e worktree atuais na status bar.

**Aceite:** criar uma worktree nova, editar um arquivo nela, ver o diff, commitar, e a worktree original continuar intacta.

### Fase 4 — GitHub
- Login por OAuth Device Flow (mostrar o código e abrir o navegador). Client ID lido de variável de ambiente `GITHUB_CLIENT_ID`.
- Detectar o repositório GitHub pelo `remote origin`.
- Listar PRs e issues (abertos por padrão, filtro por estado), ver detalhes e status dos checks.
- "Abrir em worktree" a partir de um PR: faz fetch da branch e cria a worktree.
- Criar PR a partir da branch atual (título, descrição, base).

**Aceite:** logar, ver PRs do repo, abrir um PR numa worktree e criar um PR novo a partir de uma branch local.

### Fase 5 — Agentes
- Agente = um CLI rodando num PTY dentro de uma worktree. Presets configuráveis: `claude`, `codex`, `gemini`, `opencode`, e um "comando customizado".
- Fluxo "Nova tarefa": nome da tarefa → cria branch e worktree → abre terminal com o agente → envia o prompt inicial opcional.
- Painel Agents lista todas as tarefas com worktree, branch, status e tempo rodando.
- Status inicial por heurística: `running` enquanto há saída recente, `waiting` quando parado aguardando input, `done`/`error` pelo exit code. Deixe a detecção isolada num módulo para trocar depois por hooks dos CLIs.
- Notificação nativa quando um agente passa para `waiting` ou `done`.
- Ação "Revisar": abre o diff da worktree contra a branch base.

**Aceite:** iniciar 3 agentes em paralelo em 3 worktrees, acompanhar o status de cada um e revisar o diff de um deles.

---

## 6. Fora do escopo do MVP

Não implemente agora (mas não feche portas na arquitetura):
- Navegador embutido / design mode
- SSH e worktrees remotas
- App mobile
- Integração com Linear
- Comentários em diff enviados de volta ao agente
- Sistema de extensões
- LSP (autocomplete inteligente além do que o Monaco oferece)

---

## 7. Convenções de código

- Nada de `any`. Use `unknown` e valide.
- Serviços do main são classes com dependências injetadas, testáveis sem Electron.
- Componentes React pequenos; lógica em hooks e stores, não no JSX.
- Erros do main chegam ao renderer como `{ ok: false, error: { code, message } }`; mostre toasts amigáveis.
- Logs com níveis (`debug`, `info`, `warn`, `error`) via um logger único. Nunca logar conteúdo de arquivos ou tokens.
- Commits no padrão Conventional Commits.
- Toda função de serviço nova ganha teste unitário.

---

## 8. Como trabalhar

1. Comece pela **Fase 0**.
2. Antes de cada fase, escreva um plano curto (arquivos que vai criar/alterar) e então execute.
3. Se uma decisão não estiver coberta aqui e for difícil de desfazer, pergunte. Se for fácil de desfazer, decida, siga em frente e registre a decisão em `docs/decisions.md`.
4. Mantenha um `README.md` atualizado com como rodar o projeto.
5. Teste no SO em que estiver rodando e sinalize qualquer ponto que dependa de Windows/macOS/Linux para ser verificado depois.
