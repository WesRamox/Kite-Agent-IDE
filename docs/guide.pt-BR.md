# Guia do Kite

Como usar cada parte do Kite em detalhe. Para instalar e rodar, veja o [README](../README.pt-BR.md).

## Login com GitHub

O login usa o OAuth **Device Flow**, então o app não precisa de client secret.

1. Em <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
   - _Homepage URL_: qualquer URL (ex.: a do seu repositório).
   - _Authorization callback URL_: obrigatório no formulário, mas não é usado pelo Device
     Flow (ex.: `http://127.0.0.1/callback`).
2. Na página do app, marque **Enable Device Flow** e salve.
3. Copie o **Client ID** e coloque num `.env` na pasta do projeto (fica fora do git):

   ```bash
   cp .env.example .env   # e preencha GITHUB_CLIENT_ID=Ov23li...
   pnpm dev
   ```

   No app instalado, o `.env` fica na pasta de perfil (Linux: `~/.config/Kite/.env`). Também
   dá para passar na linha de comando, que vence o arquivo: `GITHUB_CLIENT_ID=Ov23li... pnpm dev`.

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
que fazer com worktrees soltas; para voltar a ela, use o botão "Descobrir" na Central, o menu
Tarefa → "Descobrir tarefas…" ou `Ctrl/Cmd+K` → "Descobrir tarefas…". Um
`TASK.md` (primeiro título) ou `.kite-task.json` (`{ "title" }`) na pasta da tarefa dá o
título dela. Worktrees criadas depois, por qualquer script ou skill, entram sozinhas.

Abrir uma tarefa (na Central ou `Ctrl/Cmd+K`) mostra no explorer só os arquivos alterados em cada
worktree contra a branch base ("Alterados"); "Todos" mostra a árvore com uma raiz por worktree. O
quick open busca em todos os repos dela, as abas mostram o repo do arquivo e os terminais abrem
na pasta da tarefa (botão direito numa raiz: "Abrir terminal aqui"). Cada tarefa guarda as
próprias abas e terminais: trocar de tarefa não fecha nada. À direita ficam o título, a situação de
cada repo, as sessões de agente e notas. Uma sessão do Claude Code é ligada à tarefa pelo cwd ou
pelos arquivos que edita (mesmo aberta na raiz do workspace); em Conectar agentes dá para
vincular à mão.

Tarefa aprovada: "Marcar como concluída" (botão direito na Central, menu Tarefa ou os detalhes da
tarefa) a tira da Central e do `Ctrl/Cmd+K` e a guarda em "Concluídas", no fim da Central, onde
dá para desmarcar. Concluída, "Excluir worktrees…" apaga as worktrees de todos os repos dela (as
branches ficam) e manda a pasta da tarefa para a lixeira se sobrar só o `TASK.md`. Com alterações
não commitadas, o Kite pergunta de novo antes de apagar.

### Revisar e entregar uma tarefa

"Revisar" (na Central, ou botão direito na tarefa → "Revisar mudanças") abre a revisão da tarefa:
os arquivos alterados agrupados por repo, com `+/-`, contra o merge-base com a branch base de
cada repo (a padrão do `origin`, senão `main`/`master`), e o diff de cada arquivo (em linha ou
lado a lado). Inclui o que ainda não foi commitado.

- **Commit e PR nos N repos:** uma mensagem de commit para todos, título e descrição do PR, base
  por repo e rascunho opcional. Cada repo é commitado (`git add -A`), enviado ao `origin` e ganha
  um PR; com mais de um repo, cada PR recebe no fim da descrição os links dos outros PRs da
  tarefa. Um PR já aberto para a branch só é atualizado com o push. "Commit em <repo>" e "Abrir
  PR" fazem o mesmo para um repo só. Requer login no GitHub (seção [Login com GitHub](#login-com-github)).
- **Pedir ajuste ao agente:** o texto vai direto para o prompt da sessão ligada à tarefa, se ela
  roda num terminal do Kite; se roda fora, o Kite oferece "Retomar aqui".
- Os detalhes da tarefa mostram o PR de cada repo ("sem PR", "PR #42 aberto"...).

### Central de atenção

O primeiro ícone da activity bar abre a **Central de atenção**: na sidebar, as tarefas e sessões
agrupadas em Esperando você, Trabalhando, Para revisar e Sem agente; numa janela sobreposta
(status bar, menu Ver → "Abrir Central de atenção" ou `Ctrl/Cmd+J`), o que cada agente parado pede
(o comando que quer rodar ou a última mensagem), o que os outros estão fazendo e o que terminou.
Ela fecha com Esc, no X ou clicando fora, e as ações que levam a um terminal ou a uma tarefa a
fecham sozinhas. Com o Claude Code conectado, o app já abre na sidebar dela.

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
