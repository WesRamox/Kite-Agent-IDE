import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { launch, makeWorkspace, setConfirmAnswer, trashed, type Launched } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

let ctx: Launched

test.beforeEach(async () => {
  const ws = await makeWorkspace({
    '.gitignore': '*.log\n',
    'a.ts': 'export const a = 1\n',
    'src/b.ts': 'export const b = 2\n',
    'src/deep/c.ts': 'export const c = 3\n',
    'debug.log': 'ignorado',
    'node_modules/x/index.js': 'ignorado',
    'image.bin': Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02]),
  })
  ctx = await launch(ws)
})

test.afterEach(async () => {
  await ctx.cleanup()
})

const row = (p: string) => ctx.page.locator(`[data-node-id="${p}"]`)
const tab = (name: string) => ctx.page.locator('.dv-tab', { hasText: name })
const editorText = () => ctx.page.locator('.monaco-editor:visible .view-lines')

async function openWorkspace() {
  await ctx.page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await expect(row(path.join(ctx.workspace, 'a.ts'))).toBeVisible()
}

test('abre a pasta, respeita ignores e expande pastas', async () => {
  await openWorkspace()
  const ws = ctx.workspace
  await expect(row(path.join(ws, 'src'))).toBeVisible()
  await expect(row(path.join(ws, '.gitignore'))).toBeVisible()
  await expect(row(path.join(ws, 'node_modules'))).toHaveCount(0)
  await expect(row(path.join(ws, 'debug.log'))).toHaveCount(0)

  await row(path.join(ws, 'src')).click()
  await expect(row(path.join(ws, 'src', 'b.ts'))).toBeVisible()
  await expect(row(path.join(ws, 'src', 'deep'))).toBeVisible()
})

test('edita e salva com Ctrl+S', async () => {
  await openWorkspace()
  const file = path.join(ctx.workspace, 'a.ts')
  await row(file).click()
  await expect(tab('a.ts')).toBeVisible()
  await expect(editorText()).toContainText('export const a = 1')

  await editorText().click()
  await ctx.page.keyboard.press(`${mod}+End`)
  await ctx.page.keyboard.type('// editado')
  await expect(tab('a.ts').getByRole('button', { name: /Não salvo/ })).toBeVisible()

  await ctx.page.keyboard.press(`${mod}+s`)
  await expect(tab('a.ts').getByRole('button', { name: 'Fechar' })).toBeVisible()
  await expect.poll(() => readFile(file, 'utf8')).toBe('export const a = 1\n// editado')
})

test('recarrega mudanças externas e pergunta quando há alterações locais', async () => {
  await openWorkspace()
  const file = path.join(ctx.workspace, 'a.ts')
  await row(file).click()
  await expect(editorText()).toContainText('export const a = 1')

  // Sem alterações locais: recarrega sozinho.
  await writeFile(file, 'export const a = 42\n')
  await expect(editorText()).toContainText('export const a = 42')

  // Com alterações locais: pergunta (resposta 0 = recarregar do disco).
  await editorText().click()
  await ctx.page.keyboard.press(`${mod}+End`)
  await ctx.page.keyboard.type('// local')
  await expect(editorText()).toContainText('// local')
  await setConfirmAnswer(ctx.app, 0)
  await writeFile(file, 'export const a = 99\n')
  await expect(editorText()).toContainText('export const a = 99')
  await expect(editorText()).not.toContainText('// local')
})

test('árvore reflete arquivos criados fora da IDE', async () => {
  await openWorkspace()
  const created = path.join(ctx.workspace, 'externo.ts')
  await writeFile(created, '')
  await expect(row(created)).toBeVisible()
})

test('quick open com busca fuzzy', async () => {
  await openWorkspace()
  await ctx.page.keyboard.press(`${mod}+p`)
  const input = ctx.page.getByPlaceholder('Buscar arquivo pelo nome')
  await expect(input).toBeVisible()
  await input.fill('dpc')
  await expect(ctx.page.getByRole('dialog').locator('li').first()).toContainText('c.ts')
  await input.press('Enter')
  await expect(tab('c.ts')).toBeVisible()
  await expect(editorText()).toContainText('export const c = 3')
})

test('arquivo binário não abre no editor', async () => {
  await openWorkspace()
  await row(path.join(ctx.workspace, 'image.bin')).click()
  await expect(ctx.page.getByText(/image\.bin é um arquivo binário/)).toBeVisible()
  await expect(tab('image.bin')).toHaveCount(0)
})

test('cria, renomeia e exclui pelo menu de contexto', async () => {
  await openWorkspace()
  const ws = ctx.workspace

  await row(path.join(ws, 'a.ts')).click({ button: 'right' })
  await ctx.page.getByRole('menuitem', { name: 'Novo arquivo' }).click()
  await ctx.page.keyboard.type('novo.ts')
  await ctx.page.keyboard.press('Enter')
  const created = path.join(ws, 'novo.ts')
  await expect(row(created)).toBeVisible()
  await expect(tab('novo.ts')).toBeVisible()
  await expect.poll(() => readFile(created, 'utf8')).toBe('')

  await row(created).click({ button: 'right' })
  await ctx.page.getByRole('menuitem', { name: 'Renomear' }).click()
  await ctx.page.keyboard.press(`${mod}+a`)
  await ctx.page.keyboard.type('renomeado.ts')
  await ctx.page.keyboard.press('Enter')
  const renamed = path.join(ws, 'renomeado.ts')
  await expect(row(renamed)).toBeVisible()
  await expect(row(created)).toHaveCount(0)
  await expect(tab('renomeado.ts')).toBeVisible()

  await setConfirmAnswer(ctx.app, 0)
  await row(renamed).click({ button: 'right' })
  await ctx.page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()
  await expect.poll(() => trashed(ctx.app)).toEqual([renamed])
  await expect(tab('renomeado.ts')).toHaveCount(0)
})

test('mantém alterações locais quando o usuário escolhe', async () => {
  await openWorkspace()
  const file = path.join(ctx.workspace, 'a.ts')
  await row(file).click()
  await editorText().click()
  await ctx.page.keyboard.press(`${mod}+End`)
  await ctx.page.keyboard.type('// minha')
  await expect(editorText()).toContainText('// minha')

  await setConfirmAnswer(ctx.app, 1) // "Manter minhas alterações"
  await writeFile(file, 'export const a = 7\n')
  // Dá tempo do watcher entregar o evento; o editor não deve mudar.
  await ctx.page.waitForTimeout(1000)
  await expect(editorText()).toContainText('// minha')
  await expect(tab('a.ts').getByRole('button', { name: /Não salvo/ })).toBeVisible()
})

test('Ctrl+W fecha a aba e pergunta se há alterações', async () => {
  await openWorkspace()
  const file = path.join(ctx.workspace, 'a.ts')
  await row(file).click()
  await editorText().click()
  await ctx.page.keyboard.type('x')
  await setConfirmAnswer(ctx.app, 2) // Cancelar
  await ctx.page.keyboard.press(`${mod}+w`)
  await expect(tab('a.ts')).toBeVisible()

  await setConfirmAnswer(ctx.app, 1) // Não salvar
  await ctx.page.keyboard.press(`${mod}+w`)
  await expect(tab('a.ts')).toHaveCount(0)
  await expect.poll(() => readFile(file, 'utf8')).toBe('export const a = 1\n')
  // A janela continua aberta (Ctrl+W não fecha a janela).
  await expect(ctx.page.getByRole('button', { name: 'Explorer' })).toBeVisible()
})
