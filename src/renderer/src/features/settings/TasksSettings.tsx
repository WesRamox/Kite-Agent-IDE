import { useT } from '../../lib/i18n'
import { GroupingFieldset } from '../tasks/GroupingFieldset'
import { useTasksStore } from '../tasks/tasks.store'
import { Card } from './settings-ui'

export function TasksSettings() {
  const ws = useTasksStore((s) => s.workspace)
  const t = useT()
  if (!ws) {
    return (
      <Card>
        <p className="px-4 py-3.5 text-fg-muted">{t('settings.openFolderForTasks')}</p>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {/* Remonta ao trocar de workspace ou de modo, para o campo de padrão começar certo. */}
      <GroupingFieldset key={`${ws.root}:${ws.grouping.mode}`} grouping={ws.grouping} />
      <p className="text-xs leading-[1.45] text-fg-muted">{t('settings.tasksHint')}</p>
    </div>
  )
}
