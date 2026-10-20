// O navegador do quadro abre páginas da web (http e https), inclusive telas locais; nada de file:,
// javascript: e afins.
export function isWebUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#].*)?$/i
const ADDRESS = /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i

// O que a pessoa digitou na barra: endereço completo; endereço sem http (local vai em http, o
// resto em https); só a porta de uma tela local ("3001"); ou, se nada disso, uma pesquisa.
export function toBrowserUrl(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  if (/^https?:\/\//i.test(text)) return isWebUrl(text) ? new URL(text).href : null
  if (/^\d{2,5}([/?#].*)?$/.test(text)) return new URL(`http://localhost:${text}`).href
  if (LOCAL.test(text)) return new URL(`http://${text}`).href
  if (ADDRESS.test(text)) return new URL(`https://${text}`).href
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`
}
