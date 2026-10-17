import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { X } from 'lucide-react'
import { FileIcon } from '../explorer/FileIcon'
import { useActiveTask, worktreeOf } from '../tasks/tasks.store'
import { closeFile } from './editor.actions'
import { useEditorStore } from './editor.store'
import { useT } from '../../lib/i18n'

export function EditorTab({ api, params }: IDockviewPanelHeaderProps<{ path: string }>) {
  const path = params.path
  const dirty = useEditorStore((s) => s.tabs[path]?.dirty ?? false)
  const t = useT()
  // Na tarefa, o repo do arquivo vem antes do nome (dois repos podem ter o mesmo arquivo).
  const repo = worktreeOf(useActiveTask(), path)?.repoName

  return (
    <div
      title={path}
      onMouseDown={(e) => {
        // Botão do meio fecha a aba.
        if (e.button === 1) {
          e.preventDefault()
          void closeFile(path)
        }
      }}
      className="group flex h-full items-center gap-1.5 px-3"
    >
      {repo && (
        <span className="rounded bg-surface-3 px-[5px] py-px font-geist-mono text-[10px] text-fg-muted">
          {repo}
        </span>
      )}
      <FileIcon name={api.title ?? ''} kind="file" />
      <span className={dirty ? 'italic' : ''}>{api.title}</span>
      <button
        type="button"
        aria-label={dirty ? t('editor.closeDirty') : t('editor.close')}
        onClick={(e) => {
          e.stopPropagation()
          void closeFile(path)
        }}
        className="relative flex size-4 items-center justify-center rounded hover:bg-surface-3"
      >
        {dirty && <span className="size-2 rounded-full bg-fg/80 group-hover:hidden" />}
        <X size={12} className={dirty ? 'hidden group-hover:block' : ''} />
      </button>
    </div>
  )
}
