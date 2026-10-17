// Logo do Kite (mesmo desenho de resources/icon.svg, sem o fundo). As cores são da marca, não
// do tema; nos temas claros usa a variante clara (topo âmbar mais escuro, laterais mais escuras).
export function KiteLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="6.7 0 86.6 100"
      width={(size * 86.6) / 100}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <polygon
        points="50,0 90.3,23.27 50,46.54 9.7,23.27"
        className="fill-[#FFB224] light:fill-[#F59E0B]"
      />
      <polygon
        points="6.7,75 47,98.27 47,51.73 6.7,28.46"
        className="fill-[#45423E] light:fill-[#3A3734]"
      />
      <polygon
        points="93.3,75 53,98.27 53,51.73 93.3,28.46"
        className="fill-[#2C2A27] light:fill-[#161514]"
      />
    </svg>
  )
}
