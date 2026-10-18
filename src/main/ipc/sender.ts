export interface TrustedRenderer {
  // URL do index.html empacotado (file://…/renderer/index.html).
  file: string
  // Servidor do Vite em `pnpm dev`; ausente no app empacotado.
  devUrl?: string
}

// Só a página do próprio renderer chama o IPC. Um iframe, uma página navegada por engano ou
// qualquer outra origem é recusada antes de validar argumentos.
export function isTrustedSender(frameUrl: string | undefined, trusted: TrustedRenderer): boolean {
  if (!frameUrl) return false
  let url: URL
  try {
    url = new URL(frameUrl)
  } catch {
    return false
  }
  if (url.protocol === 'file:') {
    return `${url.protocol}//${url.host}${url.pathname}` === new URL(trusted.file).href
  }
  if (!trusted.devUrl) return false
  return url.origin === new URL(trusted.devUrl).origin
}
