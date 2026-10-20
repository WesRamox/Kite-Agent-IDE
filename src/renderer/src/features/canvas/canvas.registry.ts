// O que cada bloco vivo do quadro expõe para fora do React: o editor do bloco de código (salvar
// com Ctrl+S, ler o texto) e o <webview> do navegador. Fica fora do store porque são objetos do
// DOM e do Monaco, não dados do quadro.

export interface CodeHandle {
  text: () => string
  setText: (text: string) => void
  // Só nos blocos ligados a um arquivo.
  save: (() => Promise<boolean>) | null
}

export type WebviewHandle = HTMLElement & {
  loadURL: (url: string) => Promise<void>
  reload: () => void
  getURL: () => string
  executeJavaScript: (code: string) => Promise<unknown>
  capturePage: () => Promise<{ toDataURL: () => string }>
}

export const codeHandles = new Map<string, CodeHandle>()
export const webviews = new Map<string, WebviewHandle>()
