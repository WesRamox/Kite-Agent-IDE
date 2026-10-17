// Lê as cores do tema ativo direto das variáveis CSS (fonte única das paletas).
export type ThemeToken =
  | 'surface-0'
  | 'surface-1'
  | 'surface-2'
  | 'surface-3'
  | 'border'
  | 'fg'
  | 'fg-muted'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'merged'

export type Palette = Record<ThemeToken, string>

const TOKENS: ThemeToken[] = [
  'surface-0',
  'surface-1',
  'surface-2',
  'surface-3',
  'border',
  'fg',
  'fg-muted',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'merged',
]

const cache = new Map<string, Palette>()

let ctx: CanvasRenderingContext2D | null = null

// Converte qualquer cor CSS (#fff, white, rgb()...) para #rrggbb ou #rrggbbaa. O CSS do build é
// minificado (#ffffff vira #fff) e o Monaco só aceita hex de 6 ou 8 dígitos.
export function toHex(color: string): string {
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return color.toLowerCase()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i.exec(color)
  if (short)
    return `#${short
      .slice(1)
      .filter(Boolean)
      .map((c) => c + c)
      .join('')}`.toLowerCase()
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return color
  ctx.fillStyle = '#000000'
  ctx.fillStyle = color
  const normalized = String(ctx.fillStyle)
  if (normalized.startsWith('#')) return normalized
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(normalized)
  if (!m) return color
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  const alpha = m[4] === undefined ? '' : hex(Number(m[4]) * 255)
  return `#${hex(Number(m[1]))}${hex(Number(m[2]))}${hex(Number(m[3]))}${alpha}`
}

// Paleta de qualquer tema (não só o ativo): um elemento oculto com data-theme="<id>" recebe as
// variáveis daquele tema pelo CSS.
export function paletteOf(themeId: string): Palette {
  const cached = cache.get(themeId)
  if (cached) return cached
  const probe = document.createElement('div')
  probe.dataset.theme = themeId
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const raw = TOKENS.map((t) => [t, style.getPropertyValue(`--color-${t}`).trim()] as const)
  probe.remove()
  const palette = Object.fromEntries(raw.map(([t, v]) => [t, toHex(v)])) as Palette
  // CSS ainda não carregado (em dev o Vite injeta o styles.css depois dos módulos): não guarda
  // a paleta vazia no cache, para a próxima leitura pegar as cores certas.
  if (raw.some(([, v]) => v === '')) return palette
  cache.set(themeId, palette)
  return palette
}

// Mesma cor com transparência (#rrggbb → #rrggbbaa), para formatos que exigem hex.
export function withAlpha(hex: string, alpha: number): string {
  const base = hex.length === 9 ? hex.slice(0, 7) : hex
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `${base}${a.toString(16).padStart(2, '0')}`
}
