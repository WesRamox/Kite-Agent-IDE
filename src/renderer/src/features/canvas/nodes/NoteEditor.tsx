import { Bold, Eraser, Italic, List, Minus, Plus, Strikethrough, Underline } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useT } from '../../../lib/i18n'
import { HTML_MAX, plainToHtml, sanitizeNoteHtml } from '../note-html'

interface Props {
  text: string
  html: string | undefined
  onChange: (value: { text: string; html: string }) => void
}

// Cores da letra (as do tema Preto vivo).
const COLORS = [
  ['accent', '#28a9ff'],
  ['info', '#14e5d4'],
  ['success', '#42dd76'],
  ['warning', '#ffb638'],
  ['danger', '#ff4d5e'],
  ['merged', '#a95eff'],
] as const

// Nota com formatação. O texto simples (`text`) é o que o agente lê e escreve; o formatado
// (`html`) é só para a tela, e sempre passa pelo filtro antes de entrar nela. A tela só é
// reescrita quando o conteúdo vem de fora (o agente escreveu na nota): reescrever a cada letra
// joga o cursor para o começo.
export function NoteEditor({ text, html, onChange }: Props) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const shown = useRef<string | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const next = html ?? plainToHtml(text)
    if (!el || next === shown.current) return
    el.innerHTML = sanitizeNoteHtml(next)
    shown.current = next
  }, [text, html])

  const emit = () => {
    const el = ref.current
    if (!el) return
    // Apagou tudo: sobra um <br> solto que esconderia a dica.
    if (el.textContent === '' && !el.querySelector('li')) el.innerHTML = ''
    const clean = sanitizeNoteHtml(el.innerHTML)
    if (clean.length > HTML_MAX) {
      el.innerHTML = shown.current ?? ''
      return
    }
    shown.current = clean
    onChange({ text: el.innerText.replace(/\n$/, ''), html: clean })
  }

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(command, false, arg)
    emit()
  }
  const resize = (step: 1 | -1) => {
    const current = Number(document.queryCommandValue('fontSize')) || 3
    exec('fontSize', String(Math.min(7, Math.max(1, current + step))))
  }

  return (
    <div className="flex h-full flex-col">
      <div
        role="toolbar"
        aria-label={t('canvas.note.toolbar')}
        // Clicar nos botões não pode tirar a seleção do texto.
        onMouseDown={(e) => e.preventDefault()}
        className="nodrag flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1"
      >
        <Tool label={t('canvas.note.bold')} onClick={() => exec('bold')}>
          <Bold size={14} />
        </Tool>
        <Tool label={t('canvas.note.italic')} onClick={() => exec('italic')}>
          <Italic size={14} />
        </Tool>
        <Tool label={t('canvas.note.underline')} onClick={() => exec('underline')}>
          <Underline size={14} />
        </Tool>
        <Tool label={t('canvas.note.strike')} onClick={() => exec('strikeThrough')}>
          <Strikethrough size={14} />
        </Tool>
        <Divider />
        <Tool label={t('canvas.note.smaller')} onClick={() => resize(-1)}>
          <Minus size={14} />
        </Tool>
        <Tool label={t('canvas.note.bigger')} onClick={() => resize(1)}>
          <Plus size={14} />
        </Tool>
        <Divider />
        <Tool label={t('canvas.note.list')} onClick={() => exec('insertUnorderedList')}>
          <List size={14} />
        </Tool>
        <Divider />
        {COLORS.map(([name, hex]) => (
          <button
            key={name}
            type="button"
            aria-label={`${t('canvas.note.color')}: ${t(`canvas.color.${name}`)}`}
            title={t(`canvas.color.${name}`)}
            onClick={() => exec('foreColor', hex)}
            className="flex size-6 items-center justify-center rounded-md hover:bg-surface-3"
          >
            <span className="size-3 rounded-full" style={{ backgroundColor: hex }} />
          </button>
        ))}
        <Divider />
        <Tool label={t('canvas.note.clear')} onClick={() => exec('removeFormat')}>
          <Eraser size={14} />
        </Tool>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={t('canvas.note')}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={t('canvas.notePlaceholder')}
        onInput={emit}
        onPaste={(e) => {
          // Cola sempre texto limpo: formatação e HTML de fora não entram.
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
        className="kite-note-editor nodrag nowheel nopan nokey min-h-0 flex-1 overflow-auto p-3 text-[14px] leading-relaxed text-fg/90 outline-none"
      />
    </div>
  )
}

function Tool({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
    >
      {children}
    </button>
  )
}

const Divider = () => <span className="mx-0.5 h-4 w-px bg-border" />
