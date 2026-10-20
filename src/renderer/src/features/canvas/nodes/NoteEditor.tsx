import { Bold, Italic, Palette } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface NoteEditorProps {
  value: string
  onChange: (text: string) => void
  placeholder?: string
}

const COLORS = [
  { name: 'Amarelo', value: '#ffb224' },
  { name: 'Azul', value: '#60a5fa' },
  { name: 'Verde', value: '#4ade80' },
  { name: 'Rosa', value: '#f87171' },
  { name: 'Roxo', value: '#a78bfa' },
  { name: 'Padrão', value: '#ededec' },
]

export function NoteEditor({ value, onChange, placeholder }: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const handleTextChange = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const applyColor = (color: string) => {
    execCommand('foreColor', color)
    setSelectedColor(color)
    setShowColorPicker(false)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center gap-1 border-b border-border bg-surface-2/40 px-2 py-2">
        <ToolButton
          title="Negrito"
          onClick={() => execCommand('bold')}
          icon={<Bold size={14} />}
        />
        <ToolButton
          title="Itálico"
          onClick={() => execCommand('italic')}
          icon={<Italic size={14} />}
        />
        <div className="w-px bg-border" />
        <div className="relative">
          <button
            type="button"
            title="Cor do texto"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="nodrag flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <Palette size={14} />
          </button>
          {showColorPicker && (
            <div className="absolute top-8 left-0 flex gap-1 rounded-md border border-border bg-surface-2 p-2 shadow-lg">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  title={color.name}
                  onClick={() => applyColor(color.value)}
                  className="size-6 rounded-full border-2 border-border transition-transform hover:scale-110"
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleTextChange}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="nodrag nowheel min-h-0 flex-1 overflow-auto bg-transparent p-3 text-[13px] leading-relaxed text-fg/90 outline-none before:absolute before:text-fg-muted/60 before:content-[attr(data-placeholder)]"
        style={{
          position: 'relative',
        }}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  )
}

function ToolButton({
  title,
  onClick,
  icon,
}: {
  title: string
  onClick: () => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className="nodrag flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
    >
      {icon}
    </button>
  )
}
