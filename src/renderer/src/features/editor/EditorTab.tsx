import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { FileIcon } from '../../components/FileIcon'
import { useActiveTask, worktreeOf } from '../tasks/tasks.store'
import { closeFile } from './editor.actions'
import { useEditorStore } from './editor.store'
import { useT } from '../../lib/i18n'
import { TabCloseButton } from '../../components/TabCloseButton'

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
      className="group flex h-full w-full items-center gap-2 px-3"
    >
      {repo && (
        <span className="rounded bg-surface-3 px-[5px] py-px font-geist-mono text-[10px] text-fg-muted">
          {repo}
        </span>
      )}
      <FileIcon name={api.title ?? ''} kind="file" />
      <span className={`${dirty ? 'italic' : ''} text-sm`}>{api.title}</span>
      {dirty && <span className="size-2 rounded-full bg-fg/80 group-hover:hidden" />}
      {!dirty && (
        <TabCloseButton
          label={t('editor.close')}
          onClick={(e) => {
            e.stopPropagation()
            void closeFile(path)
          }}
        />
      )}
      {dirty && (
        <button
          type="button"
          aria-label={t('editor.closeDirty')}
          onClick={(e) => {
            e.stopPropagation()
            void closeFile(path)
          }}
          className="nodrag ml-auto flex size-6 items-center justify-center rounded-md text-fg-muted opacity-0 transition-all hover:bg-surface-3 hover:text-fg group-hover:opacity-100"
          title={t('editor.closeDirty')}
        >
          <span className="size-2 rounded-full bg-fg/80" />
        </button>
      )}
    </div>
  )
}
