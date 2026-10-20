import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface TabCloseButtonProps {
  label: string
  onClick: (e: React.MouseEvent) => void
}

export function TabCloseButton({ label, onClick }: TabCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="nodrag ml-auto flex size-6 items-center justify-center rounded-md text-fg-muted opacity-0 transition-all hover:bg-surface-3 hover:text-fg group-hover:opacity-100 hover:opacity-100"
      title={label}
    >
      <X size={14} strokeWidth={2} />
    </button>
  )
}
