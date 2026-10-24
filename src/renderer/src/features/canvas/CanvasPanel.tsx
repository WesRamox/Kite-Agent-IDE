import '@xyflow/react/dist/style.css'
import {
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ContextMenu, type MenuItem } from '../../components/ContextMenu'
import { useT } from '../../lib/i18n'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { AddNodeMenu } from './AddNodeMenu'
import { WorkflowBar } from './WorkflowBar'
import { DEFAULT_BROWSER_URL, EDGE_TYPE, type FlowNode } from './canvas'
import {
  addNode,
  connect,
  loadCanvas,
  onEdgesChange,
  onNodesChange,
  removeEdge,
  saveCanvas,
  setViewport,
  terminalCwd,
} from './canvas.actions'
import { useCanvasStore } from './canvas.store'
import { KiteConnectionLine, KiteEdge } from './edges/KiteEdge'
import { AgentNode } from './nodes/AgentNode'
import { BrowserNode } from './nodes/BrowserNode'
import { CodeNode } from './nodes/CodeNode'
import { NoteNode } from './nodes/NoteNode'
import { ShellNode } from './nodes/ShellNode'
import { SummaryNode } from './nodes/SummaryNode'

const nodeTypes = {
  agent: AgentNode,
  terminal: ShellNode,
  browser: BrowserNode,
  note: NoteNode,
  summary: SummaryNode,
  code: CodeNode,
}
const edgeTypes = { [EDGE_TYPE]: KiteEdge }

// Aba do quadro (estilo n8n): um por pasta aberta, salvo sozinho a cada mudança.
export function CanvasPanel() {
  const root = useWorkspaceStore((s) => s.root)
  const loadedRoot = useCanvasStore((s) => s.root)
  const active = useCanvasStore((s) => s.active)
  const t = useT()

  useEffect(() => {
    if (root && root !== useCanvasStore.getState().root) void loadCanvas(root)
  }, [root])
  // Fechar a aba (ou levá-la para outra tarefa) não perde a última mudança.
  useEffect(() => () => void saveCanvas(), [])

  if (!root) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-0 font-geist text-fg-muted">
        {t('canvas.noFolder')}
      </div>
    )
  }
  if (loadedRoot !== root) return <div className="h-full bg-surface-0" />
  return (
    // Trocar de workflow monta o quadro de novo, com a vista que ele tinha.
    <ReactFlowProvider key={`${root}:${active}`}>
      <Board />
    </ReactFlowProvider>
  )
}

function Board() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [viewport] = useState(() => useCanvasStore.getState().viewport)
  const [menu, setMenu] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [context, setContext] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const flow = useReactFlow()
  const t = useT()

  // Botão direito no fundo do quadro: cria o bloco ali onde clicou.
  const paneMenu = (x: number, y: number): MenuItem[] => {
    const at = flow.screenToFlowPosition({ x, y })
    const cwd = terminalCwd()
    return [
      ...(cwd
        ? [
            {
              label: t('canvas.menu.addTerminal'),
              onSelect: () => addNode({ kind: 'terminal', cwd }, at),
            },
          ]
        : []),
      {
        label: t('canvas.menu.addBrowser'),
        onSelect: () => addNode({ kind: 'browser', url: DEFAULT_BROWSER_URL }, at),
      },
      { label: t('canvas.menu.addNote'), onSelect: () => addNode({ kind: 'note', text: '' }, at) },
      {
        label: t('canvas.menu.addCode'),
        onSelect: () => addNode({ kind: 'code', language: 'typescript', text: '' }, at),
      },
      { label: t('canvas.menu.more'), onSelect: () => setMenu(true) },
      { label: t('canvas.menu.fit'), onSelect: () => void flow.fitView({ duration: 400 }) },
    ]
  }

  return (
    <div
      className={`kite-canvas relative h-full w-full bg-surface-0 [container-type:size] ${connecting ? 'kite-connecting' : ''}`}
    >
      <ReactFlow<FlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        onConnect={connect}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={(c) => c.source !== c.target}
        defaultViewport={viewport}
        onMoveEnd={(_event, vp) => setViewport(vp)}
        connectionLineComponent={KiteConnectionLine}
        defaultEdgeOptions={{ type: EDGE_TYPE }}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode={['Delete', 'Backspace']}
        proOptions={{ hideAttribution: true }}
        onPaneContextMenu={(e) => {
          e.preventDefault()
          setContext({ x: e.clientX, y: e.clientY, items: paneMenu(e.clientX, e.clientY) })
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault()
          setContext({
            x: e.clientX,
            y: e.clientY,
            items: [
              { label: t('canvas.removeLink'), onSelect: () => removeEdge(edge.id), danger: true },
            ],
          })
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.6} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap position="bottom-right" pannable zoomable nodeBorderRadius={6} />
        {/* Uma faixa só no topo: com o quadro estreito, a barra de workflows encolhe em vez de
            ficar por baixo do "+". A faixa não pega cliques; só as duas pontas. */}
        <Panel
          position="top-left"
          className="pointer-events-none right-0 flex items-start justify-between gap-2"
        >
          <div className="pointer-events-auto min-w-0">
            <WorkflowBar />
          </div>
          <div className="pointer-events-auto shrink-0">
            <AddNodeMenu open={menu} onOpenChange={setMenu} />
          </div>
        </Panel>
      </ReactFlow>
      {nodes.length === 0 && <EmptyCanvas onAdd={() => setMenu(true)} />}
      {context && (
        <ContextMenu
          x={context.x}
          y={context.y}
          items={context.items}
          onClose={() => setContext(null)}
        />
      )}
    </div>
  )
}

// Quadro vazio: o convite para o primeiro bloco, como o "Add first step" do n8n.
function EmptyCanvas({ onAdd }: { onAdd: () => void }) {
  const t = useT()
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-geist">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('canvas.addFirst')}
          className="kite-empty-add pointer-events-auto flex size-24 items-center justify-center rounded-2xl border-2 border-dashed border-fg-muted/40 text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Plus size={36} strokeWidth={1.6} />
        </button>
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-fg">{t('canvas.empty')}</span>
          <span className="text-xs leading-normal text-fg-muted">{t('canvas.emptyHint')}</span>
        </div>
      </div>
    </div>
  )
}
