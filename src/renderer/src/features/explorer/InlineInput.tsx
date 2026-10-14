import { useEffect, useRef } from 'react'

interface Props {
  initial: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

// Campo de edição na própria linha da árvore (criar/renomear).
export function InlineInput({ initial, onSubmit, onCancel }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const input = ref.current
    if (!input) return
    input.focus()
    // Seleciona o nome sem a extensão, como no VS Code.
    const dot = initial.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : initial.length)
  }, [initial])

  const finish = (submit: boolean) => {
    if (done.current) return
    done.current = true
    if (submit) onSubmit(ref.current?.value ?? '')
    else onCancel()
  }

  return (
    <input
      ref={ref}
      defaultValue={initial}
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      className="min-w-0 flex-1 rounded-sm border border-accent bg-surface-0 px-1 text-fg outline-none"
    />
  )
}
