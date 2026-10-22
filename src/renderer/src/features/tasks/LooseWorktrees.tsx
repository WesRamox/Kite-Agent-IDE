import type { TaskWorktree, WorkspaceTasks } from '@shared/types'
import { useT } from '../../lib/i18n'
import { MenuButton, RepoName, ROW, SMALL_BTN, Where } from './DiscoverCards'
import { groupLoose, patternMisses, type LooseGroup } from './loose-groups'
import { moveWorktree, moveWorktrees, setGrouping } from './tasks.actions'

// Worktrees que não caíram em nenhuma tarefa, na tela Descobrir: grupos sugeridos (mesma branch em
// repositórios diferentes) em cima e as que ficam sozinhas embaixo.

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted'

export function LooseWorktrees(props: {
  ws: WorkspaceTasks
  onMenu: (paths: string[], x: number, y: number) => void
}) {
  const { ws } = props
  const tr = useT()
  if (ws.unassigned.length === 0) return null
  const loose = groupLoose(ws.unassigned)
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-dashed border-fg-muted/30 px-4 py-3.5">
      <span className={LABEL}>{tr('discover.looseCount', { n: ws.unassigned.length })}</span>
      {loose.groups.length > 0 && (
        <p className="text-xs leading-normal text-fg-muted">{tr('discover.suggestedHint')}</p>
      )}
      {loose.groups.map((g) => (
        <LooseGroupCard
          key={g.key}
          group={g}
          root={ws.root}
          onMenu={(x, y) =>
            props.onMenu(
              g.worktrees.map((w) => w.path),
              x,
              y,
            )
          }
        />
      ))}
      {loose.single.length > 0 && loose.groups.length > 0 && (
        <span className={`mt-1 ${LABEL}`}>{tr('discover.looseOthers')}</span>
      )}
      {loose.single.map((w) => (
        <LooseRow
          key={w.path}
          wt={w}
          root={ws.root}
          onMenu={(x, y) => props.onMenu([w.path], x, y)}
        />
      ))}
    </div>
  )
}

// O padrão de pasta não achou nenhuma worktree: oferece o agrupamento automático.
export function PatternMiss({ ws }: { ws: WorkspaceTasks }) {
  const tr = useT()
  if (!patternMisses(ws)) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-accent/40 bg-accent/10 px-4 py-3">
      <p className="min-w-0 flex-[1_1_320px] leading-normal">
        {tr('discover.patternMiss', { pattern: ws.grouping.pattern })}
      </p>
      <button
        type="button"
        onClick={() => void setGrouping({ ...ws.grouping, mode: 'auto' })}
        className="h-[26px] shrink-0 rounded-md bg-accent px-2.5 text-xs font-semibold text-accent-fg hover:bg-accent/85"
      >
        {tr('discover.useAuto')}
      </button>
    </div>
  )
}

// Grupo sugerido: worktrees soltas da mesma branch em repositórios diferentes.
function LooseGroupCard(props: {
  group: LooseGroup
  root: string
  onMenu: (x: number, y: number) => void
}) {
  const { group } = props
  const tr = useT()
  const paths = group.worktrees.map((w) => w.path)
  const branch = group.worktrees[0]?.branch ?? group.key
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-surface-1 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium" title={group.key}>
            {group.key}
          </span>
          <span className="truncate text-xs text-fg-muted" title={branch}>
            {tr('discover.sameBranch', { n: group.worktrees.length })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void moveWorktrees(paths, 'new')}
          className={SMALL_BTN}
        >
          {tr('discover.createGroup', { n: group.worktrees.length })}
        </button>
        <MenuButton
          label={tr('discover.groupActions', { name: group.key })}
          onOpen={props.onMenu}
        />
      </div>
      <div className="flex flex-col gap-2">
        {group.worktrees.map((w) => (
          <div key={w.path} className={ROW}>
            <RepoName wt={w} />
            <Where wt={w} root={props.root} showBranch={false} />
            <span />
          </div>
        ))}
      </div>
    </div>
  )
}

function LooseRow(props: {
  wt: TaskWorktree
  root: string
  onMenu: (x: number, y: number) => void
}) {
  const { wt } = props
  const tr = useT()
  return (
    <div className={ROW}>
      <RepoName wt={wt} />
      <Where wt={wt} root={props.root} showBranch />
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void moveWorktree(wt.path, 'new')}
          className={SMALL_BTN}
        >
          {tr('discover.createTask')}
        </button>
        <MenuButton
          label={tr('discover.worktreeActions', { name: wt.repoName })}
          onOpen={props.onMenu}
        />
      </span>
    </div>
  )
}
