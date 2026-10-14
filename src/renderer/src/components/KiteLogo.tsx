// Logo do Kite (mesmo desenho de resources/icon.svg, sem o fundo).
export function KiteLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="-150 -190 300 520"
      width={size}
      height={(size * 520) / 300}
      aria-hidden="true"
      className={className}
    >
      <g transform="rotate(-12)">
        <path d="M0 -168 L118 -20 L0 128 L-118 -20 Z" fill="var(--color-accent)" />
        <path d="M0 -168 L118 -20 L0 -20 Z" fill="var(--color-accent)" opacity="0.7" />
        <path d="M0 -20 L-118 -20 L0 128 Z" fill="var(--color-accent)" opacity="0.85" />
        <path
          d="M0 -168 V128 M-118 -20 H118"
          stroke="var(--color-fg)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M0 128 C 22 168, -30 190, -6 226 S 28 268, 6 300"
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M-10 196 l-26 -10 M8 248 l26 -8"
          stroke="var(--color-warning)"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}
