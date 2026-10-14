import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useState } from 'react'
import type { TerminalSession } from './terminal-session'

interface Props {
  session: TerminalSession
  onClose: () => void
}

export function TerminalSearch({ session, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)

  const find = (forward: boolean) => {
    if (!query) return
    setNotFound(!(forward ? session.findNext(query) : session.findPrevious(query)))
  }

  const close = () => {
    session.clearSearch()
    onClose()
    session.focus()
  }

  return (
    <div className="absolute top-1 right-4 z-10 flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 shadow-lg">
      <input
        autoFocus
        value={query}
        placeholder="Buscar no terminal"
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value)
          setNotFound(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') find(!e.shiftKey)
          else if (e.key === 'Escape') close()
          else return
          e.preventDefault()
        }}
        className={`w-48 bg-transparent text-fg outline-none ${notFound ? 'text-red-300' : ''}`}
      />
      <button
        type="button"
        aria-label="Anterior"
        onClick={() => find(false)}
        className="text-fg-muted hover:text-fg"
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        aria-label="Próximo"
        onClick={() => find(true)}
        className="text-fg-muted hover:text-fg"
      >
        <ArrowDown size={14} />
      </button>
      <button
        type="button"
        aria-label="Fechar busca"
        onClick={close}
        className="text-fg-muted hover:text-fg"
      >
        <X size={14} />
      </button>
    </div>
  )
}
