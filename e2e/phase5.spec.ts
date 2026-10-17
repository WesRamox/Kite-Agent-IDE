import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { closeWindow, git, launch, makeWorkspace, type Launched } from './app'

const FAKE_AGENT = path.join(__dirname, 'fixtures', 'fake-agent.cjs')

let ctx: Launched
let userData: string

async function seedPresets(dir: string) {
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, 'agents.json'),
    JSON.stringify({
      presets: [
        {
          id: 'custom',
          name: 'Agente falso',
          command: `node ${FAKE_AGENT}`,
          promptMode: 'arg',
          promptFlag: '',
        },
      ],
      tasks: [],
    }),
  )
}

// Substitui a notificação nativa por um gravador (sem popups durante os testes).
async function recordNotifications(app: ElectronApplication) {
  await app.evaluate(({ Notification }) => {
    const g = globalThis as unknown as { __notes: { title: string; body: string }[] }
    g.__notes = []
    Notification.isSupported = () => true
    Notification.prototype.show = function (this: { title: string; body: string }) {
      g.__notes.push({ title: this.title, body: this.body })
    }
  })
}

const notes = (app: ElectronApplication) =>
  app.evaluate(() =>
    (globalThis as unknown as { __notes: { title: string }[] }).__notes.map((n) => n.title),
  )

test.beforeEach(async () => {
  const ws = await makeWorkspace({ 'README.md': '# projeto\n' })
  git(ws, 'init', '-q', '-b', 'main')
  git(ws, 'add', '.')
  git(ws, 'commit', '-q', '-m', 'inicial')
  userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  await seedPresets(userData)
  ctx = await launch(ws, { userData })
  await recordNotifications(ctx.app)
})

test.afterEach(async () => {
  await ctx.cleanup()
  await rm(userData, { recursive: true, force: true })
  await rm(`${ctx.workspace}-worktrees`, { recursive: true, force: true })
})

// Item da tarefa na sidebar da Central de atenção.
const card = (page: Page, name: string) =>
  page.getByRole('complementary').getByRole('button', { name: `Tarefa ${name}` })
const showCentral = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Atividades' })
    .getByRole('button', { name: /^Central de atenção/ })
    .click()
// Fase 10: a branch sugerida é o nome da tarefa ("Tarefa A" → "Tarefa-A"); num workspace que é
// um repo só, a worktree fica em ../<repo>-worktrees/<branch>.
const branchOf = (name: string) => name.replace(/ /g, '-')
const wtOf = (name: string) => path.join(`${ctx.workspace}-worktrees`, branchOf(name))

async function startTask(page: Page, name: string, prompt: string) {
  await page.getByRole('button', { name: '+ Nova' }).click()
  const form = page.getByRole('form', { name: 'Nova tarefa' })
  await form.getByLabel('Nome da tarefa').fill(name)
  await form.getByLabel('Agente').selectOption('custom')
  await form.getByLabel('Prompt inicial').fill(prompt)
  await form.getByRole('button', { name: 'Iniciar agente' }).click()
  // Criar a tarefa abre o explorer dela; a lista fica na Central.
  await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText(name)
  await showCentral(page)
  await expect(card(page, name)).toBeVisible()
}

async function typeInAgent(page: Page, name: string, text: string) {
  await card(page, name).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Terminal do agente' }).click()
  await expect(page.locator('.dv-tab.dv-active-tab', { hasText: name })).toBeVisible()
  await page.locator('.xterm:visible').last().click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

test('aceite: 3 agentes em paralelo em 3 worktrees, status de cada um e revisão do diff', async () => {
  test.setTimeout(90_000)
  const page = ctx.page
  await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await expect(page.locator('footer')).toContainText('main')
  await showCentral(page)

  for (const [name, prompt] of [
    ['Tarefa A', "fazer A com 'aspas'"],
    ['Tarefa B', 'fazer B'],
    ['Tarefa C', 'fazer C'],
  ] as const) {
    await startTask(page, name, prompt)
  }

  // Cada agente roda na sua worktree, numa branch própria, com o prompt recebido.
  for (const [name, prompt] of [
    ['Tarefa A', "fazer A com 'aspas'"],
    ['Tarefa B', 'fazer B'],
    ['Tarefa C', 'fazer C'],
  ] as const) {
    const wt = wtOf(name)
    const slug = name.toLowerCase().replace(/ /g, '-')
    await expect
      .poll(() => readFile(path.join(wt, `saida-${slug}.txt`), 'utf8').catch(() => ''))
      .toBe(`${prompt}\n`)
    expect(git(wt, 'branch', '--show-current').trim()).toBe(branchOf(name))
  }
  // Parados esperando input → "esperando você", com notificação.
  for (const name of ['Tarefa A', 'Tarefa B', 'Tarefa C']) {
    await expect(card(page, name).getByLabel('Status')).toContainText('esperando você', {
      timeout: 15_000,
    })
  }
  await expect
    .poll(() => notes(ctx.app))
    .toEqual(
      expect.arrayContaining([
        'Tarefa A está aguardando você',
        'Tarefa B está aguardando você',
        'Tarefa C está aguardando você',
      ]),
    )
  await expect(page.locator('footer')).toContainText('● 3 esperando você')

  // Respostas diferentes: A termina bem, B falha, C continua esperando.
  await typeInAgent(page, 'Tarefa A', 'sair')
  await expect(card(page, 'Tarefa A').getByLabel('Status')).toContainText('terminou')
  await typeInAgent(page, 'Tarefa B', 'falhar')
  await expect(card(page, 'Tarefa B').getByLabel('Status')).toContainText('erro (código 3)')
  await expect(card(page, 'Tarefa C').getByLabel('Status')).toContainText('esperando você')
  await expect
    .poll(() => notes(ctx.app))
    .toEqual(expect.arrayContaining(['Tarefa A terminou', 'Tarefa B falhou']))
  await expect(page.locator('footer')).toContainText('● 1 esperando você')
  await expect(page.locator('footer')).toContainText('● 1 para revisar')

  // Revisão do diff da Tarefa A contra main, pela seção "Para revisar" da Central.
  await page.locator('footer').getByRole('button', { name: '● 1 para revisar' }).click()
  await page
    .getByRole('region', { name: 'Para revisar' })
    .getByLabel('Tarefa Tarefa A')
    .getByRole('button', { name: 'Revisar' })
    .click()
  const files = page.getByRole('complementary', { name: 'Arquivos alterados' })
  await expect(files).toContainText('README.md')
  await expect(files).toContainText('saida-tarefa-a.txt')
  await files.getByText('README.md').click()
  await expect(
    page.locator('.monaco-diff-editor:visible .modified-in-monaco-diff-editor'),
  ).toContainText('editado por Tarefa A')

  // O repositório original não foi tocado.
  await expect(readFile(path.join(ctx.workspace, 'README.md'), 'utf8')).resolves.toBe('# projeto\n')
  expect(git(ctx.workspace, 'status', '--porcelain').trim()).toBe('')
})

test('fechar o terminal não para o agente; fechar o app encerra e marca como interrompido', async () => {
  test.setTimeout(60_000)
  const page = ctx.page
  await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await showCentral(page)
  await startTask(page, 'Longa', 'x')
  const pidFile = path.join(wtOf('Longa'), 'agent.pid')
  await expect.poll(() => readFile(pidFile, 'utf8').catch(() => '')).toMatch(/^\d+$/)
  const pid = Number(await readFile(pidFile, 'utf8'))

  await page.getByRole('button', { name: 'Fechar terminal do agente' }).click()
  await expect(page.locator('.dv-tab', { hasText: 'Longa' })).toHaveCount(0)
  await expect(card(page, 'Longa').getByLabel('Status')).toContainText(/trabalhando|esperando/)
  expect(() => process.kill(pid, 0)).not.toThrow()

  // Reabrir conecta de novo ao mesmo processo, que segue aceitando input.
  await typeInAgent(page, 'Longa', 'oi')
  await expect(card(page, 'Longa').getByLabel('Status')).toContainText(/trabalhando|esperando/)

  await closeWindow(ctx.app)
  const alive = () => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  await expect.poll(alive, { timeout: 10_000 }).toBe(false)

  const again = await launch(ctx.workspace, { userData, keepWorkspace: true })
  try {
    await showCentral(again.page)
    await expect(card(again.page, 'Longa').getByLabel('Status')).toContainText('interrompido')
    await expect(stat(wtOf('Longa')).then(() => true)).resolves.toBe(true)
  } finally {
    await again.cleanup()
  }
})
