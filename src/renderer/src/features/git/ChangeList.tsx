import type { GitFileChange } from '@shared/types'
import { Minus, Plus } from 'lucide-react'
import { basename, dirname, relative } from '../../lib/paths'
import { FileIcon } from '../../components/FileIcon'
import { KIND_COLOR, kindLabel, KIND_LETTER } from '../../lib/git-format'
import { openDiff, stage, unstage } from './git.actions'
import { useT } from '../../lib/i18n'

interface Props {
  title: string
  root: string
  files: GitFileChange[]
  staged: boolean
  onAll: () => void
}

export function ChangeList({ title, root, files, staged, onAll }: Props) {
  const t = useT()
  if (files.length === 0) return null
  const AllIcon = staged ? Minus : Plus
  return (
    <section className="mt-2" aria-label={title}>
      <header className="group flex h-6 items-center px-3 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
        <span className="flex-1">
          {title}{' '}
          <span className="ml-1 rounded bg-surface-3 px-1.5 font-normal">{files.length}</span>
        </span>
        <button
          type="button"
          title={staged ? t('git.unstageAll') : t('git.stageAll')}
          aria-label={staged ? t('git.unstageAll') : t('git.stageAll')}
          onClick={onAll}
          className="rounded p-0.5 hover:bg-surface-3 hover:text-fg"
        >
          <AllIcon size={14} />
        </button>
      </header>
      <ul>
        {files.map((f) => {
          const kind = staged ? f.staged : f.unstaged
          if (!kind) return null
          const rel = relative(root, f.path)
          const dir = rel.includes('/') ? dirname(rel) : ''
          return (
            <li
              key={f.path}
              title={`${rel} — ${kindLabel(kind)}`}
              onClick={() => openDiff(f.path, staged)}
              className="group flex h-6 cursor-pointer items-center gap-1.5 px-3 hover:bg-surface-2"
            >
              <FileIcon name={basename(f.path)} kind="file" />
              <span className={`truncate ${kind === 'deleted' ? 'line-through' : ''}`}>
                {basename(f.path)}
              </span>
              <span className="truncate text-[11px] text-fg-muted">{dir}</span>
              <button
                type="button"
                aria-label={
                  staged
                    ? t('git.unstageFile', { name: basename(f.path) })
                    : t('git.stageFile', { name: basename(f.path) })
                }
                onClick={(e) => {
                  e.stopPropagation()
                  void (staged ? unstage([f.path]) : stage([f.path]))
                }}
                className="ml-auto hidden rounded p-0.5 text-fg-muted group-hover:block hover:bg-surface-3 hover:text-fg"
              >
                {staged ? <Minus size={14} /> : <Plus size={14} />}
              </button>
              <span
                className={`w-3 shrink-0 text-center font-mono text-[11px] ${KIND_COLOR[kind]}`}
              >
                {KIND_LETTER[kind]}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
