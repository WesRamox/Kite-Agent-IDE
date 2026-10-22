import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import electronPath from 'electron'
import { git, launch, makeWorkspace } from './app'

const FAKE_AGENT = path.join(__dirname, 'fixtures', 'fake-agent.cjs')

// Uma "tela local" de verdade para o navegador do quadro.
async function localPage(): Promise<{ server: Server; url: string }> {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end('<h1>Tela local do Kite</h1>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `localhost:${port}` }
}

// O kite-mcp como o Claude Code o usa: JSON-RPC por stdin/stdout, com o binário do Electron em
// modo Node e o socket do perfil de teste.
interface McpReply {
  result?: {
    serverInfo?: { name: string }
    tools?: { name: string }[]
    content?: { type: string; text?: string }[]
    isError?: boolean
  }
}
function mcp(caller: string, socket: string) {
  // No Node, o pacote electron exporta o caminho do binário.
  const proc = spawn(
    electronPath as unknown as string,
    [path.join(__dirname, '..', 'out', 'main', 'kite-mcp.js')],
    {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        KITE_CANVAS_SOCKET: socket,
        KITE_CANVAS_CALLER: caller,
      },
    },
  )
  const waiting = new Map<number, (msg: McpReply) => void>()
  let buffer = ''
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    buffer += chunk
    for (let i = buffer.indexOf('\n'); i >= 0; i = buffer.indexOf('\n')) {
      const msg = JSON.parse(buffer.slice(0, i)) as McpReply & { id: number }
      buffer = buffer.slice(i + 1)
      waiting.get(msg.id)?.(msg)
    }
  })
  let next = 1
  const request = (method: string, params: object = {}) =>
    new Promise<McpReply>((resolve) => {
      const id = next++
      waiting.set(id, resolve)
      proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  const call = async (name: string, args: object) =>
    (await request('tools/call', { name, arguments: args })).result?.content
      ?.map((c) => c.text ?? '')
      .join('\n') ?? ''
  return { request, call, close: () => proc.kill() }
}

// Arrasta de uma alça a outra, como a pessoa liga dois blocos. Espera a vista parar (enquadrar e
// deslizar até um bloco novo são animados) e tenta de novo se o arraste não pegou.
async function link(page: Page, from: Locator, to: Locator): Promise<void> {
  const edges = page.locator('.react-flow__edge')
  const before = await edges.count()
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForTimeout(500)
    const a = await from.boundingBox()
    const b = await to.boundingBox()
    if (!a || !b) throw new Error('sem as alças dos blocos')
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2 + 24, a.y + a.height / 2, { steps: 4 })
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 })
    await page.mouse.up()
    if ((await edges.count()) > before) return
  }
}

// Ponto do fundo do quadro sem nenhum bloco em cima, para o botão direito abrir o menu do quadro.
// Coordenada fixa quebra quando um bloco muda de tamanho (a nota ganhou barra de formatação).
async function emptySpot(page: Page): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(() => {
    const pane = document.querySelector('.react-flow__pane')?.getBoundingClientRect()
    if (!pane) return null
    for (let y = pane.top + 40; y < pane.bottom - 40; y += 30) {
      for (let x = pane.left + 40; x < pane.right - 40; x += 30) {
        if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y }
      }
    }
    return null
  })
  if (!spot) throw new Error('sem espaço livre no quadro')
  return spot
}

const guestUrls = (app: import('@playwright/test').ElectronApplication) =>
  app.evaluate(({ webContents }) =>
    webContents
      .getAllWebContents()
      .filter((w) => w.getType() === 'webview')
      .map((w) => w.getURL()),
  )

test('quadro: blocos de nota, navegador local e agente, ligados e salvos', async () => {
  test.skip(process.platform === 'win32', 'agente falso usa shell POSIX; Windows verificar depois')
  test.setTimeout(120_000)
  const root = await makeWorkspace({ 'README.md': '# app\n' })
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'inicial')
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  await mkdir(userData, { recursive: true })
  await writeFile(
    path.join(userData, 'agents.json'),
    JSON.stringify({
      presets: [
        {
          id: 'custom',
          name: 'Agente falso',
          command: `node '${FAKE_AGENT}'`,
          promptMode: 'arg',
          promptFlag: '',
        },
      ],
      tasks: [],
    }),
  )
  const { server, url } = await localPage()
  const ctx = await launch(root, { userData })
  try {
    const { page, app } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    // Um agente aberto pelo Kite, como a pessoa faz: "+ Nova" com o agente falso.
    await expect(page.locator('footer')).toContainText('main')
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    await page.getByRole('button', { name: '+ Nova' }).click()
    const form = page.getByRole('form', { name: 'Nova tarefa' })
    await form.getByLabel('Nome da tarefa').fill('Pix')
    await form.getByLabel('Agente').selectOption('custom')
    await form.getByLabel('Prompt inicial').fill('oi')
    await form.getByRole('button', { name: 'Iniciar agente' }).click()
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText('Pix')

    // O botão da barra da esquerda abre o quadro como aba; vazio, ele convida ao primeiro bloco.
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: 'Quadro' })
      .click()
    await expect(page.getByText('Seu quadro está vazio')).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar o primeiro bloco' }).click()
    await page.getByRole('menuitem', { name: /^Nota/ }).click()
    await page.getByRole('textbox', { name: 'Nota', exact: true }).fill('testar o checkout')
    await expect(page.getByText('Seu quadro está vazio')).toBeHidden()

    // Navegador: só a porta já abre a tela local.
    await page.getByRole('button', { name: 'Adicionar bloco' }).click()
    await page.getByRole('menuitem', { name: /^Navegador/ }).click()
    const address = page.getByRole('textbox', { name: 'Endereço da tela' })
    await address.fill(url.replace('localhost:', ''))
    await address.press('Enter')
    await expect.poll(() => guestUrls(app)).toContain(`http://${url}/`)

    // Agente: o terminal dele fica dentro do bloco e responde por ali. "sair" encerra o agente
    // falso, e o bloco mostra que ele terminou.
    await page.getByRole('button', { name: 'Adicionar bloco' }).click()
    await page.getByRole('menuitem', { name: /^Terminal de agente/ }).click()
    await page.getByRole('menuitem', { name: /Pix/ }).click()
    const agent = page.locator('.react-flow__node-agent')
    await expect(agent.locator('.xterm')).toBeVisible()
    await expect(agent).not.toContainText('erro')

    // Liga a saída da nota na entrada do navegador, arrastando como no n8n (antes, enquadra tudo).
    await page.locator('.react-flow__controls-fitview').click()
    await link(
      page,
      page.locator('.react-flow__node-note .kite-handle[data-handleid="right"]'),
      page.locator('.react-flow__node-browser .kite-handle[data-handleid="left"]'),
    )
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)

    await agent.locator('.xterm').click()
    await page.keyboard.type('sair')
    await page.keyboard.press('Enter')
    await expect(agent).toContainText('terminou')

    // Workflows: um novo começa vazio; voltar ao primeiro traz os blocos de volta.
    const workflows = page.getByRole('button', { name: 'Workflows desta pasta' })
    await expect(workflows).toContainText('Meu workflow')
    await workflows.click()
    await page.getByRole('menuitem', { name: 'Novo workflow' }).click()
    await expect(page.getByText('Seu quadro está vazio')).toBeVisible()
    await expect(workflows).toContainText('Pix')
    await workflows.click()
    await page.getByRole('menuitemradio', { name: 'Meu workflow' }).click()
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
    await expect(page.getByTitle('O quadro também salva sozinho a cada mudança.')).toContainText(
      'Salvo',
    )

    // Tudo salvo no perfil, por pasta: os dois workflows, com o primeiro aberto.
    await expect
      .poll(async () => {
        const saved = JSON.parse(
          await readFile(path.join(userData, 'canvas.json'), 'utf8').catch(() => '{}'),
        )
        const ws = saved.workspaces?.[root]
        if (!ws) return null
        const open = ws.boards.find((b: { id: string }) => b.id === ws.active)
        return [ws.boards.length, open.name, open.state.nodes.length, open.state.edges.length]
      })
      .toEqual([2, 'Meu workflow', 3, 1])

    // Botão direito no bloco: o menu dele. "Duplicar" cria outra nota igual.
    await page.locator('.react-flow__node-note header').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Duplicar' }).click()
    await expect(page.locator('.react-flow__node-note')).toHaveCount(2)

    // Cor pelo botão direito e nome com dois cliques.
    const firstNote = page.locator('.react-flow__node-note').first()
    await firstNote.locator('header').click({ button: 'right' })
    await page.getByRole('button', { name: 'Azul', exact: true }).click()
    await expect(firstNote.locator('header')).toHaveClass(/bg-info/)
    // A cor tinge o bloco todo, não só a borda e o cabeçalho.
    await expect(firstNote.locator('.kite-node')).toHaveClass(/bg-info\/8/)
    await firstNote.getByTitle('Dois cliques para renomear').dblclick()
    await page.keyboard.type('Plano do Pix')
    await page.keyboard.press('Enter')
    await expect(firstNote.locator('header')).toContainText('Plano do Pix')

    // Terminal comum pelo botão direito no fundo de um workflow vazio, na pasta da tarefa; dali
    // dá para iniciar um agente (um subagente) pelo menu do bloco.
    await workflows.click()
    await page.getByRole('menuitemradio', { name: 'Pix', exact: true }).click()
    await expect(page.getByText('Seu quadro está vazio')).toBeVisible()
    const pane = await page.locator('.react-flow__pane').boundingBox()
    if (!pane) throw new Error('sem o fundo do quadro')
    await page.mouse.click(pane.x + 120, pane.y + pane.height - 160, { button: 'right' })
    await page.getByRole('menuitem', { name: 'Novo terminal aqui' }).click()
    const shell = page.locator('.react-flow__node-terminal')
    await expect(shell.locator('.xterm')).toBeVisible()
    const cwd = path.join(path.dirname(root), `${path.basename(root)}-worktrees`, 'Pix')
    await shell.locator('.xterm').click()
    await page.keyboard.type('echo kite > terminal-do-quadro.txt')
    await page.keyboard.press('Enter')
    await expect
      .poll(() => readFile(path.join(cwd, 'terminal-do-quadro.txt'), 'utf8').catch(() => ''))
      .toBe('kite\n')

    // Ferramentas do quadro: a nota ligada ao terminal é lida e escrita por um agente rodando nele,
    // e quem está ligado ao terminal manda comando para ele. Tudo pelo kite-mcp, como o Claude Code.
    await page.mouse.click(pane.x + pane.width - 380, pane.y + 150, { button: 'right' })
    await page.getByRole('menuitem', { name: 'Nova nota aqui' }).click()
    const note = page.locator('.react-flow__node-note')
    const noteText = note.getByRole('textbox', { name: 'Nota', exact: true })
    await noteText.fill('segredo do quadro')
    // O terminal passa da borda da tela: enquadra tudo antes de ligar.
    await page.locator('.react-flow__controls-fitview').click()
    // Da nota para o terminal (a ligação vale nos dois sentidos); a alça de saída do terminal
    // pode ficar sob o minimapa.
    await link(
      page,
      note.locator('.kite-handle[data-handleid="right"]'),
      shell.locator('.kite-handle[data-handleid="left"]'),
    )
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
    const ids = await expect
      .poll(async () => {
        const saved = JSON.parse(await readFile(path.join(userData, 'canvas.json'), 'utf8'))
        const board = saved.workspaces[root].boards.find((b: { name: string }) => b.name === 'Pix')
        return board?.state.edges.length === 1 ? 'pronto' : null
      })
      .toBe('pronto')
      .then(async () => {
        const saved = JSON.parse(await readFile(path.join(userData, 'canvas.json'), 'utf8'))
        const board = saved.workspaces[root].boards.find((b: { name: string }) => b.name === 'Pix')
        const kind = (k: string) =>
          board.state.nodes.find((n: { data: { kind: string } }) => n.data.kind === k).id as string
        return { term: kind('terminal'), note: kind('note') }
      })
    const socket = path.join(userData, 'canvas.sock')
    const fromTerminal = mcp(`node:${ids.term}`, socket)
    const fromNote = mcp(`node:${ids.note}`, socket)
    try {
      const init = await fromTerminal.request('initialize', { protocolVersion: '2025-06-18' })
      expect(init.result).toMatchObject({ serverInfo: { name: 'kite' } })
      const listed = await fromTerminal.request('tools/list')
      expect(listed.result?.tools?.map((t) => t.name)).toContain('quadro_enviar')
      expect(await fromTerminal.call('quadro_blocos', {})).toContain(ids.note)
      expect(await fromTerminal.call('quadro_ler', { bloco: ids.note })).toBe('segredo do quadro')
      await fromTerminal.call('quadro_escrever', {
        bloco: ids.note,
        texto: ' + escrito pelo agente',
        modo: 'acrescentar',
      })
      await expect(noteText).toHaveText('segredo do quadro + escrito pelo agente')
      // Bloco que não está ligado: recusado.
      expect(await fromTerminal.call('quadro_ler', { bloco: 'outro' })).toContain('não está ligado')
      await fromNote.call('quadro_enviar', { bloco: ids.term, texto: 'echo mcp > pelo-agente.txt' })
      await expect
        .poll(() => readFile(path.join(cwd, 'pelo-agente.txt'), 'utf8').catch(() => ''))
        .toBe('mcp\n')
    } finally {
      fromTerminal.close()
      fromNote.close()
    }

    // Bloco de código: rascunho escrito ali mesmo, guardado no quadro.
    const free = await emptySpot(page)
    await page.mouse.click(free.x, free.y, { button: 'right' })
    await page.getByRole('menuitem', { name: 'Novo código aqui' }).click()
    const code = page.locator('.react-flow__node-code')
    await code.locator('.monaco-editor .view-lines').click()
    await page.keyboard.type('const pix = 1')
    await expect
      .poll(async () => {
        const saved = JSON.parse(await readFile(path.join(userData, 'canvas.json'), 'utf8'))
        const board = saved.workspaces[root].boards.find((b: { name: string }) => b.name === 'Pix')
        return board.state.nodes.find((n: { data: { kind: string } }) => n.data.kind === 'code')
          ?.data.text
      })
      .toBe('const pix = 1')

    await shell.locator('header').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Iniciar Agente falso aqui' }).click()
    await expect
      .poll(() => readFile(path.join(cwd, 'saida-sem-nome.txt'), 'utf8').catch(() => ''))
      .toBe('\n')
  } finally {
    await ctx.cleanup()
    server.close()
  }
})
