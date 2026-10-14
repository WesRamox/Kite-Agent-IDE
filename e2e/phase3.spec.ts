import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { git, launch, makeWorkspace, type Launched } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

let ctx: Launched

test.beforeEach(async () => {
  const ws = await makeWorkspace({ 'a.txt': 'original\n', 'src/b.ts': 'export const b = 1\n' })
  git(ws, 'init', '-q', '-b', 'main')
  git(ws, 'add', '.')
  git(ws, 'commit', '-q', '-m', 'inicial')
  ctx = await launch(ws)
})

test.afterEach(async () => {
  await ctx.cleanup()
  await rm(`${ctx.workspace}-worktrees`, { recursive: true, force: true })
})

async function openRepo() {
  await ctx.page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await expect(
    ctx.page.locator(`[data-node-id="${path.join(ctx.workspace, 'a.txt')}"]`),
  ).toBeVisible()
}

const statusBar = () => ctx.page.locator('footer')
const gitView = () => ctx.page.getByRole('button', { name: 'Git', exact: true }).click()
const explorerView = () => ctx.page.getByRole('button', { name: 'Explorer' }).click()

test('aceite: worktree nova, editar, diff, commit, e a original intacta', async () => {
  const page = ctx.page
  await openRepo()
  await expect(statusBar()).toContainText('main')
  await expect(statusBar()).toContainText('worktree principal')

  // Cria a worktree pela UI.
  await gitView()
  await page.getByRole('button', { name: 'Nova worktree' }).click()
  await page.getByPlaceholder('Branch da worktree').fill('feat/teste')
  await expect(page.getByText('Cria a branch feat/teste a partir do HEAD atual.')).toBeVisible()
  await page.getByPlaceholder('Branch da worktree').press('Enter')
  const wtPath = path.join(`${ctx.workspace}-worktrees`, 'feat-teste')
  await expect(page.getByRole('button', { name: 'Abrir worktree feat-teste' })).toBeVisible()

  // Abre a worktree como workspace.
  await page.getByRole('button', { name: 'Abrir worktree feat-teste' }).click()
  await expect(statusBar()).toContainText('feat/teste')
  await expect(statusBar()).toContainText('feat-teste')

  // Edita e salva um arquivo nela.
  await explorerView()
  const file = path.join(wtPath, 'a.txt')
  await page.locator(`[data-node-id="${file}"]`).click()
  await page.locator('.monaco-editor:visible .view-lines').click()
  await page.keyboard.press(`${mod}+End`)
  await page.keyboard.type('mudado na worktree')
  await page.keyboard.press(`${mod}+s`)
  await expect.poll(() => readFile(file, 'utf8')).toBe('original\nmudado na worktree')

  // A árvore marca o arquivo como modificado.
  await expect(page.locator(`[data-node-id="${file}"]`)).toContainText('M')

  // Vê o diff.
  await gitView()
  const changes = page.getByRole('region', { name: 'Alterações' })
  await changes.getByText('a.txt').click()
  await expect(page.locator('.dv-tab', { hasText: 'a.txt (alterações)' })).toBeVisible()
  await expect(page.locator('.monaco-diff-editor:visible')).toBeVisible()
  await expect(
    page.locator('.monaco-diff-editor:visible .modified-in-monaco-diff-editor'),
  ).toContainText('mudado na worktree')

  // Stage e commit.
  await page.getByRole('button', { name: 'Adicionar tudo ao stage' }).click()
  await expect(page.getByRole('region', { name: 'Stage' })).toContainText('a.txt')
  await page.getByPlaceholder(/Mensagem do commit/).fill('feat: muda a.txt na worktree')
  await page.getByRole('button', { name: /^Commit/ }).click()
  await expect(page.getByText(/Commit [0-9a-f]+ criado/)).toBeVisible()
  await expect(page.getByText('Nenhuma alteração.')).toBeVisible()

  // Conferência pelo git: commit na branch da worktree, principal intacta.
  expect(git(wtPath, 'log', '-1', '--format=%s').trim()).toBe('feat: muda a.txt na worktree')
  expect(git(wtPath, 'branch', '--show-current').trim()).toBe('feat/teste')
  expect(git(ctx.workspace, 'log', '-1', '--format=%s', 'main').trim()).toBe('inicial')
  expect(git(ctx.workspace, 'status', '--porcelain').trim()).toBe('')
  await expect(readFile(path.join(ctx.workspace, 'a.txt'), 'utf8')).resolves.toBe('original\n')
})

test('painel acompanha operações feitas fora da IDE (terminal/agentes)', async () => {
  const page = ctx.page
  await openRepo()
  await gitView()
  await expect(page.getByText('Nenhuma alteração.')).toBeVisible()

  await writeFile(path.join(ctx.workspace, 'src', 'b.ts'), 'export const b = 2\n')
  git(ctx.workspace, 'add', 'src/b.ts')
  await expect(page.getByRole('region', { name: 'Stage' })).toContainText('b.ts')

  git(ctx.workspace, 'commit', '-q', '-m', 'fora da IDE')
  await expect(page.getByText('Nenhuma alteração.')).toBeVisible()

  git(ctx.workspace, 'switch', '-q', '-c', 'outra')
  await expect(statusBar()).toContainText('outra')
})

test('cria e troca de branch pelo seletor, unstage e diff do stage', async () => {
  const page = ctx.page
  await openRepo()
  await gitView()

  await page.getByRole('button', { name: 'Trocar de branch' }).click()
  await page.getByPlaceholder('Nova branch a partir daqui…').fill('feature/x')
  await page.getByPlaceholder('Nova branch a partir daqui…').press('Enter')
  await expect(statusBar()).toContainText('feature/x')
  expect(git(ctx.workspace, 'branch', '--show-current').trim()).toBe('feature/x')

  await page.getByRole('button', { name: 'Trocar de branch' }).click()
  await page.getByRole('menuitem', { name: 'main' }).click()
  await expect(statusBar()).toContainText('main')

  await writeFile(path.join(ctx.workspace, 'a.txt'), 'staged\n')
  git(ctx.workspace, 'add', 'a.txt')
  const stageList = page.getByRole('region', { name: 'Stage' })
  await expect(stageList).toContainText('a.txt')
  await stageList.getByText('a.txt').click()
  await expect(page.locator('.dv-tab', { hasText: 'a.txt (stage)' })).toBeVisible()
  await expect(
    page.locator('.monaco-diff-editor:visible .original-in-monaco-diff-editor'),
  ).toContainText('original')

  await page.getByRole('button', { name: 'Remover tudo do stage' }).click()
  await expect(page.getByRole('region', { name: 'Alterações' })).toContainText('a.txt')
  expect(git(ctx.workspace, 'diff', '--cached', '--name-only').trim()).toBe('')
})
