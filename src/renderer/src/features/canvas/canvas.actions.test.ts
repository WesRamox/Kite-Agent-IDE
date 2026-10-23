// @vitest-environment happy-dom
import type { CanvasState, Task, WorkspaceCanvas, WorkspaceTasks } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, installApi, ok } from '../../test/fake-api'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useTasksStore } from '../tasks/tasks.store'
import { EMPTY_STATE, type FlowNode } from './canvas'
import { useCanvasStore } from './canvas.store'

// O shell do bloco é um terminal de verdade; o que importa aqui é o que é digitado nele.
const getSession = vi.fn()
vi.mock('../terminal/terminal.actions', () => ({ getSession: (id: string) => getSession(id) }))
const actions = await import('./canvas.actions')

const note = (id: string, x = 0, y = 0): FlowNode => ({
  id,
  type: 'note',
  position: { x, y },
  width: 200,
  height: 100,
  data: { kind: 'note', text: id },
})

const task = (patch: Partial<Task>): Task => ({
  id: 't1',
  key: 'TECH-1',
  name: 'TECH-1',
  source: 'folder',
  why: '',
  folder: null,
  worktrees: [],
  hidden: false,
  pending: false,
  done: false,
  notes: '',
  summary: [],
  rule: [],
  ...patch,
})

const openTask = (t: Task) =>
  useTasksStore.getState().set({
    activeTaskId: t.id,
    workspace: {
      root: '/ws',
      repos: [],
      ignoredRepos: [],
      tasks: [t],
      unassigned: [],
      grouping: { mode: 'auto', pattern: '.worktrees/{tarefa}/{repo}' },
      scanDepth: 2,
      imported: true,
      sessionLinks: {},
    } satisfies WorkspaceTasks,
  })

const withNote = (id: string): CanvasState => ({
  ...EMPTY_STATE,
  nodes: [{ id, x: 10, y: 20, width: 200, height: 100, data: { kind: 'note', text: id } }],
})

const save = vi.fn(async (_root: string, _canvas: WorkspaceCanvas) => ok(undefined))
const confirm = vi.fn(async () => ok(0))
const store = () => useCanvasStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  save.mockClear()
  confirm.mockClear()
  getSession.mockReset()
  installApi({ canvas: { save }, dialog: { confirm } })
  useWorkspaceStore.setState({ root: '/ws' })
  useTasksStore.getState().reset()
  useCanvasStore.setState({
    root: '/ws',
    active: 'a',
    boards: [{ id: 'a', name: 'A' }],
    others: {},
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    status: 'saved',
  })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loadCanvas', () => {
  it('abre o workflow ativo e guarda os outros na gaveta', async () => {
    installApi({
      canvas: {
        load: vi.fn(async () =>
          ok({
            active: 'b',
            boards: [
              { id: 'a', name: 'A', state: EMPTY_STATE },
              { id: 'b', name: 'B', state: withNote('n1') },
            ],
          }),
        ),
      },
    })
    await actions.loadCanvas('/ws')
    expect(store().active).toBe('b')
    expect(store().boards.map((b) => b.name)).toEqual(['A', 'B'])
    expect(Object.keys(store().others)).toEqual(['a'])
    expect(store().nodes.map((n) => n.id)).toEqual(['n1'])
    expect(store().status).toBe('saved')
  })

  it('descarta a resposta se outra pasta foi aberta no meio', async () => {
    useCanvasStore.setState({ root: null, active: '', boards: [] })
    installApi({
      canvas: {
        load: vi.fn(async () => {
          useWorkspaceStore.setState({ root: '/outra' })
          return ok({ active: 'a', boards: [{ id: 'a', name: 'A', state: EMPTY_STATE }] })
        }),
      },
    })
    await actions.loadCanvas('/ws')
    expect(store().root).toBeNull()
    expect(store().boards).toEqual([])
  })

  it('pasta sem workflow nenhum não muda o quadro', async () => {
    useCanvasStore.setState({ root: null, active: '', boards: [] })
    installApi({ canvas: { load: vi.fn(async () => ok({ active: '', boards: [] })) } })
    await actions.loadCanvas('/ws')
    expect(store().root).toBeNull()
  })
})

describe('saveCanvas', () => {
  it('grava o workflow aberto junto com os que estão na gaveta', async () => {
    useCanvasStore.setState({
      boards: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      others: { b: withNote('guardado') },
      nodes: [note('aberto', 10, 20)],
    })
    await actions.saveCanvas()
    expect(save).toHaveBeenCalledTimes(1)
    const [root, canvas] = save.mock.calls[0] ?? []
    expect(root).toBe('/ws')
    expect(canvas).toMatchObject({
      active: 'a',
      boards: [
        { id: 'a', name: 'A', state: { nodes: [{ id: 'aberto', x: 10, y: 20 }] } },
        { id: 'b', name: 'B', state: withNote('guardado') },
      ],
    })
    expect(store().status).toBe('saved')
  })

  it('marca erro quando o main recusa gravar', async () => {
    installApi({ canvas: { save: vi.fn(async () => fail('disco cheio')) } })
    await actions.saveCanvas()
    expect(store().status).toBe('error')
  })

  it('sem pasta aberta não grava nada', async () => {
    useCanvasStore.setState({ root: null })
    await actions.saveCanvas()
    expect(save).not.toHaveBeenCalled()
  })

  it('várias mudanças seguidas viram uma gravação só', async () => {
    actions.onNodesChange([{ type: 'add', item: note('n1') }])
    actions.onNodesChange([{ type: 'add', item: note('n2') }])
    expect(store().status).toBe('saving')
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400)
    expect(save).toHaveBeenCalledTimes(1)
    expect(store().status).toBe('saved')
  })

  it('só selecionar um bloco não grava', () => {
    useCanvasStore.setState({ nodes: [note('n1')] })
    actions.onNodesChange([{ type: 'select', id: 'n1', selected: true }])
    expect(store().status).toBe('saved')
  })
})

describe('workflows', () => {
  it('novo workflow leva o nome da tarefa aberta, sem repetir nome', () => {
    openTask(task({ name: 'TECH-1' }))
    useCanvasStore.setState({ boards: [{ id: 'a', name: 'TECH-1' }], nodes: [note('n1')] })
    actions.newWorkflow()
    expect(store().boards.map((b) => b.name)).toEqual(['TECH-1', 'TECH-1 (2)'])
    expect(store().active).not.toBe('a')
    expect(store().nodes).toEqual([])
    expect(store().others.a?.nodes.map((n) => n.id)).toEqual(['n1'])
  })

  it('sem tarefa aberta, o nome é "Workflow N"', () => {
    expect(actions.suggestedWorkflowName()).toBe('Workflow 2')
  })

  it('o "Salvar" sugere o nome da tarefa só enquanto o nome ainda é o padrão', () => {
    openTask(task({ name: 'TECH-1' }))
    expect(actions.suggestedSaveName('Workflow 3')).toBe('TECH-1')
    expect(actions.suggestedSaveName('Meu nome')).toBe('Meu nome')
  })

  it('"Salvar como" guarda uma cópia, segue nela e deixa o original como estava', async () => {
    useCanvasStore.setState({ nodes: [note('n1')] })
    actions.saveWorkflowAs('  Cópia  ')
    expect(store().boards.map((b) => b.name)).toEqual(['A', 'Cópia'])
    expect(store().nodes.map((n) => n.id)).toEqual(['n1'])
    expect(store().others.a?.nodes.map((n) => n.id)).toEqual(['n1'])
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('"Salvar como" com nome vazio não faz nada', () => {
    actions.saveWorkflowAs('   ')
    expect(store().boards).toHaveLength(1)
  })

  it('trocar de workflow devolve o atual à gaveta', () => {
    useCanvasStore.setState({
      boards: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      others: { b: withNote('de-b') },
      nodes: [note('de-a')],
    })
    actions.switchWorkflow('b')
    expect(store().active).toBe('b')
    expect(store().nodes.map((n) => n.id)).toEqual(['de-b'])
    expect(Object.keys(store().others)).toEqual(['a'])
    expect(store().others.a?.nodes.map((n) => n.id)).toEqual(['de-a'])
  })

  it('trocar para o workflow aberto, ou para um que não existe, não muda nada', () => {
    useCanvasStore.setState({ nodes: [note('n1')] })
    actions.switchWorkflow('a')
    actions.switchWorkflow('nao-existe')
    expect(store().active).toBe('a')
    expect(store().nodes.map((n) => n.id)).toEqual(['n1'])
  })

  it('renomear corta o espaço, limita em 80 letras e ignora nome vazio', () => {
    actions.renameWorkflow('a', '  Novo  ')
    expect(store().boards[0]?.name).toBe('Novo')
    actions.renameWorkflow('a', 'x'.repeat(100))
    expect(store().boards[0]?.name).toHaveLength(80)
    actions.renameWorkflow('a', '   ')
    expect(store().boards[0]?.name).toHaveLength(80)
  })

  describe('apagar', () => {
    beforeEach(() =>
      useCanvasStore.setState({
        boards: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
        others: { b: withNote('de-b') },
        nodes: [note('de-a')],
      }),
    )

    it('pede confirmação e, se era o aberto, passa para outro', async () => {
      await actions.deleteWorkflow('a')
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(store().boards.map((b) => b.id)).toEqual(['b'])
      expect(store().active).toBe('b')
      expect(store().nodes.map((n) => n.id)).toEqual(['de-b'])
      expect(store().others).toEqual({})
    })

    it('cancelar mantém tudo', async () => {
      confirm.mockResolvedValueOnce(ok(1))
      await actions.deleteWorkflow('b')
      expect(store().boards).toHaveLength(2)
    })

    it('o último workflow não se apaga', async () => {
      useCanvasStore.setState({ boards: [{ id: 'a', name: 'A' }], others: {} })
      await actions.deleteWorkflow('a')
      expect(confirm).not.toHaveBeenCalled()
      expect(store().boards).toHaveLength(1)
    })
  })
})

describe('blocos e ligações', () => {
  it('um bloco novo entra selecionado e desmarca os outros', () => {
    useCanvasStore.setState({ nodes: [{ ...note('n1'), selected: true }] })
    actions.addNode({ kind: 'note', text: 'novo' }, { x: 5, y: 6 })
    expect(store().nodes).toHaveLength(2)
    expect(store().nodes[0]?.selected).toBe(false)
    expect(store().nodes[1]).toMatchObject({ selected: true, position: { x: 5, y: 6 } })
  })

  it('duplicar copia o bloco, um pouco abaixo e à direita, do mesmo tamanho', () => {
    useCanvasStore.setState({ nodes: [{ ...note('n1', 10, 20), width: 300, height: 150 }] })
    actions.duplicateNode('n1')
    expect(store().nodes[1]).toMatchObject({
      position: { x: 50, y: 60 },
      width: 300,
      height: 150,
      data: { kind: 'note', text: 'n1' },
    })
  })

  it('ligar um bloco com ele mesmo não faz nada', () => {
    actions.connect({ source: 'n1', target: 'n1', sourceHandle: null, targetHandle: null })
    expect(store().edges).toEqual([])
  })

  it('a ligação guarda os lados e a mesma ligação não entra duas vezes', () => {
    const link = { source: 'n1', target: 'n2', sourceHandle: 'bottom', targetHandle: 'top' }
    actions.connect(link)
    actions.connect(link)
    expect(store().edges).toHaveLength(1)
    expect(store().edges[0]).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'top' })
  })

  it('remover um bloco leva junto as ligações dele', () => {
    useCanvasStore.setState({
      nodes: [note('n1'), note('n2'), note('n3')],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n1', target: 'n3' },
      ],
    })
    actions.removeNode('n2')
    expect(store().nodes.map((n) => n.id)).toEqual(['n1', 'n3'])
    expect(store().edges.map((e) => e.id)).toEqual(['e3'])
  })

  it('desligar um bloco tira só as ligações dele', () => {
    useCanvasStore.setState({
      nodes: [note('n1'), note('n2')],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n3', target: 'n4' },
      ],
    })
    actions.disconnectNode('n1')
    expect(store().nodes).toHaveLength(2)
    expect(store().edges.map((e) => e.id)).toEqual(['e2'])
  })

  it('remover uma ligação tira só ela', () => {
    useCanvasStore.setState({
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    })
    actions.removeEdge('e1')
    expect(store().edges.map((e) => e.id)).toEqual(['e2'])
  })

  it('nome vazio devolve o bloco ao nome do tipo', () => {
    useCanvasStore.setState({ nodes: [note('n1')] })
    actions.setNodeLabel('n1', '  Meu bloco ')
    expect(store().nodes[0]?.data.label).toBe('Meu bloco')
    actions.setNodeLabel('n1', '   ')
    expect(store().nodes[0]?.data).not.toHaveProperty('label')
  })

  it('cor nula tira a cor do bloco', () => {
    useCanvasStore.setState({ nodes: [note('n1')] })
    actions.setNodeColor('n1', 'success')
    expect(store().nodes[0]?.data.color).toBe('success')
    actions.setNodeColor('n1', null)
    expect(store().nodes[0]?.data).not.toHaveProperty('color')
  })
})

describe('terminalCwd', () => {
  it('usa a pasta da tarefa aberta', () => {
    openTask(task({ folder: '/ws/.worktrees/TECH-1' }))
    expect(actions.terminalCwd()).toBe('/ws/.worktrees/TECH-1')
  })

  it('sem pasta da tarefa, usa a primeira worktree dela', () => {
    openTask(
      task({
        worktrees: [
          { repo: '/ws/api', repoName: 'api', path: '/ws/wt/api', branch: 'x', head: 'a' },
        ],
      }),
    )
    expect(actions.terminalCwd()).toBe('/ws/wt/api')
  })

  it('sem tarefa aberta, usa a pasta aberta', () => {
    expect(actions.terminalCwd()).toBe('/ws')
  })
})

describe('terminal do quadro', () => {
  it('"Iniciar agente aqui" digita o comando no shell do bloco', async () => {
    const type = vi.fn()
    getSession.mockReturnValue({ type })
    installApi({ canvas: { launchCommand: vi.fn(async () => ok('claude --mcp-config x')) } })
    await actions.startAgentInNode('n1', 'claude')
    expect(getSession).toHaveBeenCalledWith('canvas-term:n1')
    expect(type).toHaveBeenCalledWith('claude --mcp-config x\r')
  })

  it('se o main não monta o comando, nada é digitado', async () => {
    const type = vi.fn()
    getSession.mockReturnValue({ type })
    installApi({ canvas: { launchCommand: vi.fn(async () => fail('sem agente')) } })
    await actions.startAgentInNode('n1', 'claude')
    expect(type).not.toHaveBeenCalled()
  })
})

describe('saveCodeFile', () => {
  it('devolve true quando o arquivo foi salvo', async () => {
    const writeFile = vi.fn(async () => ok(undefined))
    installApi({ fs: { writeFile } })
    expect(await actions.saveCodeFile('/ws/a.ts', 'x', 'utf8')).toBe(true)
    expect(writeFile).toHaveBeenCalledWith('/ws/a.ts', 'x', 'utf8')
  })

  it('devolve false quando o main recusa', async () => {
    installApi({ fs: { writeFile: vi.fn(async () => fail('sem permissão')) } })
    expect(await actions.saveCodeFile('/ws/a.ts', 'x', 'utf8')).toBe(false)
  })
})
