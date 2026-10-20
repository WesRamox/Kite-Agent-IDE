import type { NodeProps } from '@xyflow/react'
import { FileText } from 'lucide-react'
import { useT } from '../../../lib/i18n'
import { join } from '../../../lib/paths'
import { openFile } from '../../editor/editor.actions'
import { openTask } from '../../tasks/tasks.actions'
import { useTasksStore } from '../../tasks/tasks.store'
import { TaskRule, TaskSummary } from '../../tasks/TaskSummary'
import type { FlowNodeOf } from '../canvas'
import { NodeFrame } from './NodeFrame'

// Resumo e regra de negócio de uma tarefa (do TASK.md), os mesmos do painel de detalhes.
export function SummaryNode({ id, data, selected }: NodeProps<FlowNodeOf<'summary'>>) {
  const task = useTasksStore((s) => s.workspace?.tasks.find((x) => x.id === data.taskId))
  const t = useT()
  return (
    <NodeFrame
      id={id}
      data={data}
      selected={selected}
      icon={FileText}
      title={task?.name ?? t('canvas.taskGone')}
      menu={
        task
          ? [
              { label: t('canvas.menu.openTask'), onSelect: () => void openTask(task.id) },
              ...(task.folder
                ? [
                    {
                      label: t('canvas.menu.openTaskFile'),
                      onSelect: () => void openFile(join(task.folder ?? '', 'TASK.md')),
                    },
                  ]
                : []),
            ]
          : []
      }
    >
      <div className="nowheel flex h-full flex-col gap-2 overflow-y-auto p-3">
        {task ? (
          <>
            <TaskSummary task={task} />
            <TaskRule task={task} />
          </>
        ) : (
          <p className="text-xs text-fg-muted">{t('canvas.taskGone')}</p>
        )}
      </div>
    </NodeFrame>
  )
}
