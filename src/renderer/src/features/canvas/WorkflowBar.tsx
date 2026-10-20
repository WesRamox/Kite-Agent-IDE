import {
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import {
  deleteWorkflow,
  newWorkflow,
  renameWorkflow,
  saveCanvasNow,
  saveWorkflowAs,
  suggestedSaveName,
  switchWorkflow,
} from './canvas.actions'
import { useCanvasStore } from './canvas.store'

const ICON_BUTTON =
  'flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-2 hover:text-fg'

// Canto de cima do quadro, como no n8n: o nome do workflow (com a lista dos workflows da pasta e o
// lápis para renomear), o botão Salvar (com nome, ou como um novo) e o estado de salvamento. O
// quadro também salva sozinho a cada mudança.
export function WorkflowBar() {
  const boards = useCanvasStore((s) => s.boards)
  const active = useCanvasStore((s) => s.active)
  const status = useCanvasStore((s) => s.status)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  const current = boards.find((b) => b.id === active)

  useEffect(() => {
    if (!open && !saving) return
    const close = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      setOpen(false)
      setSaving(false)
    }
    window.addEventListener('mousedown', close, true)
    return () => window.removeEventListener('mousedown', close, true)
  }, [open, saving])

  return (
    <div ref={ref} className="relative font-geist text-fg">
      <div className="flex h-10 items-center rounded-lg border border-border bg-surface-2 shadow-lg">
        {editing === active && current ? (
          <NameInput
            initial={current.name}
            onDone={(name) => {
              if (name !== null) renameWorkflow(active, name)
              setEditing(null)
            }}
          />
        ) : (
          <button
            type="button"
            aria-label={t('canvas.workflows')}
            aria-expanded={open}
            onClick={() => {
              setSaving(false)
              setOpen(!open)
            }}
            onDoubleClick={() => {
              setOpen(false)
              setEditing(active)
            }}
            className="flex h-full items-center gap-2 rounded-l-lg pr-2 pl-3 text-[13px] font-medium hover:bg-surface-3"
          >
            <span className="max-w-56 truncate">{current?.name}</span>
            <ChevronDown
              size={14}
              className={`text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        )}
        {editing !== active && (
          <button
            type="button"
            aria-label={t('canvas.renameCurrent')}
            title={t('canvas.renameCurrent')}
            onClick={() => {
              setOpen(false)
              setEditing(active)
            }}
            className="flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <Pencil size={13} />
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          aria-expanded={saving}
          onClick={() => {
            setOpen(false)
            setSaving(!saving)
          }}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-fg hover:bg-surface-3"
        >
          <Save size={13} />
          {t('canvas.save')}
        </button>
        <span
          title={t('canvas.autoSaveHint')}
          className="flex h-full items-center gap-1.5 pr-3 pl-1.5 text-xs text-fg-muted"
        >
          {status === 'saving' && <LoaderCircle size={13} className="animate-spin" />}
          {status === 'saved' && <Check size={13} className="text-success" />}
          {status === 'error' && <CircleAlert size={13} className="text-danger" />}
          {status === 'saving'
            ? t('canvas.saving')
            : status === 'saved'
              ? t('canvas.saved')
              : t('canvas.notSaved')}
        </span>
      </div>

      {saving && current && (
        <SaveForm
          initial={suggestedSaveName(current.name)}
          onSave={(name) => {
            renameWorkflow(active, name)
            void saveCanvasNow()
            setSaving(false)
          }}
          onSaveAs={(name) => {
            saveWorkflowAs(name)
            setSaving(false)
          }}
        />
      )}

      {open && (
        <div
          role="menu"
          aria-label={t('canvas.workflows')}
          className="absolute top-12 left-0 w-[300px] rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
            {t('canvas.workflows')}
          </p>
          <div className="flex max-h-72 flex-col overflow-y-auto">
            {boards.map((b) => (
              <div
                key={b.id}
                className="group flex items-center gap-0.5 rounded-lg pr-1 hover:bg-surface-3"
              >
                {editing === b.id ? (
                  <NameInput
                    initial={b.name}
                    onDone={(name) => {
                      if (name !== null) renameWorkflow(b.id, name)
                      setEditing(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={b.id === active}
                    onClick={() => {
                      switchWorkflow(b.id)
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-[13px]"
                  >
                    <Check
                      size={13}
                      className={b.id === active ? 'shrink-0 text-accent' : 'invisible shrink-0'}
                    />
                    <span className="truncate">{b.name}</span>
                  </button>
                )}
                {editing !== b.id && (
                  <button
                    type="button"
                    aria-label={`${t('canvas.rename')} ${b.name}`}
                    title={t('canvas.rename')}
                    onClick={() => setEditing(b.id)}
                    className={ICON_BUTTON}
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {editing !== b.id && boards.length > 1 && (
                  <button
                    type="button"
                    aria-label={t('canvas.deleteWorkflow', { name: b.name })}
                    title={t('canvas.delete')}
                    onClick={() => void deleteWorkflow(b.id)}
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <Trash size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              newWorkflow()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-surface-3"
          >
            <Plus size={14} className="text-fg-muted" />
            {t('canvas.newWorkflow')}
          </button>
        </div>
      )}
    </div>
  )
}

// Campo de renomear: Enter ou sair do campo confirma; Esc desiste (devolve null).
function NameInput({
  initial,
  onDone,
}: {
  initial: string
  onDone: (name: string | null) => void
}) {
  const [value, setValue] = useState(initial)
  const t = useT()
  return (
    <input
      autoFocus
      aria-label={t('canvas.workflowName')}
      value={value}
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value)
        if (e.key === 'Escape') onDone(null)
      }}
      className="mx-1 h-8 min-w-0 flex-1 rounded-md border border-accent bg-surface-0 px-2 text-[13px] text-fg outline-none"
    />
  )
}

// "Salvar": o nome do workflow (sugere o da tarefa quando ainda está com o nome padrão), salvar
// com esse nome ou guardar como um workflow novo.
function SaveForm({
  initial,
  onSave,
  onSaveAs,
}: {
  initial: string
  onSave: (name: string) => void
  onSaveAs: (name: string) => void
}) {
  const [name, setName] = useState(initial)
  const t = useT()
  const valid = name.trim().length > 0
  return (
    <form
      aria-label={t('canvas.saveTitle')}
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(name)
      }}
      className="absolute top-12 left-0 flex w-[340px] flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3.5 shadow-2xl"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
          {t('canvas.workflowName')}
        </span>
        <input
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="h-8 rounded-md border border-border bg-surface-0 px-2 text-[13px] text-fg outline-none focus:border-accent"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!valid}
          className="h-8 flex-1 rounded-md bg-accent text-xs font-semibold text-accent-fg hover:bg-accent/85 disabled:opacity-40"
        >
          {t('canvas.save')}
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSaveAs(name)}
          className="h-8 flex-1 rounded-md border border-border text-xs text-fg hover:bg-surface-3 disabled:opacity-40"
        >
          {t('canvas.saveAs')}
        </button>
      </div>
      <p className="text-[11px] leading-normal text-fg-muted">{t('canvas.autoSaveHint')}</p>
    </form>
  )
}
