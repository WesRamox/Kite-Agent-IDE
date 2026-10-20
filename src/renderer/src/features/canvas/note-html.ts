// Texto formatado das notas. Só um punhado de marcas passa; o resto é descartado. O que vem do
// disco, de um agente ou de uma colagem nunca entra na tela sem passar por aqui.

export const HTML_MAX = 60_000

const KEEP = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'div', 'p', 'ul', 'ol', 'li'])
const DROP = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'noscript',
  'svg',
  'math',
  'link',
  'meta',
  'head',
  'title',
])
const FONT_SIZES = ['x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large']
const COLOR =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i
const SIZE = /^(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|\d{1,2}(\.\d+)?px)$/

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function plainToHtml(text: string): string {
  return escapeHtml(text).split('\n').join('<br>')
}

// Só cor, tamanho e ênfase; cada valor confere com uma lista, então nada escapa do atributo.
function allowedStyle(el: HTMLElement): string {
  const out: string[] = []
  const font = el.tagName === 'FONT'
  const color = (el.style.color || (font ? (el.getAttribute('color') ?? '') : '')).trim()
  if (COLOR.test(color)) out.push(`color: ${color}`)
  const size = (
    el.style.fontSize || (font ? (FONT_SIZES[Number(el.getAttribute('size')) - 1] ?? '') : '')
  ).trim()
  if (SIZE.test(size)) out.push(`font-size: ${size}`)
  const weight = el.style.fontWeight
  if (weight === 'bold' || Number(weight) >= 600) out.push('font-weight: bold')
  if (el.style.fontStyle === 'italic') out.push('font-style: italic')
  const lines = [
    (el.style.textDecorationLine || el.style.textDecoration).includes('underline') && 'underline',
    (el.style.textDecorationLine || el.style.textDecoration).includes('line-through') &&
      'line-through',
  ].filter(Boolean)
  if (lines.length) out.push(`text-decoration: ${lines.join(' ')}`)
  return out.join('; ')
}

function walk(node: Node): string {
  if (node.nodeType === 3) return escapeHtml(node.textContent ?? '')
  if (node.nodeType !== 1) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  if (DROP.has(tag)) return ''
  if (tag === 'br') return '<br>'
  const inner = Array.from(el.childNodes).map(walk).join('')
  if (KEEP.has(tag)) return `<${tag}>${inner}</${tag}>`
  const css = allowedStyle(el)
  return css ? `<span style="${css}">${inner}</span>` : inner
}

export function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.childNodes).map(walk).join('')
}
