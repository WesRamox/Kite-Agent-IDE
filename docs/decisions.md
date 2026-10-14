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
