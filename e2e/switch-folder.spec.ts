import path from 'node:path'
import { expect, test } from '@playwright/test'
import { closeWindow, git, launch, makeWorkspace } from './app'

// Regressão da tela preta da 0.1.0/0.1.1: com uma tarefa aberta, abrir outra pasta zerava o
// workspace e os seletores com `?? []` entravam em loop de renderização (erro #185 do React).
test('abrir outra pasta com uma tarefa aberta não derruba a interface', async () => {
  test.setTimeout(60_000)
  const base = await makeWorkspace({
    'loja/api/server.ts': 'export const api = 1\n',
    'loja/web/page.tsx': 'export const web = 1\n',
    'outra/README.md': '# outra\n',
  })
  const root = path.join(base, 'loja')
  for (const r of ['api', 'web']) {
    const dir = path.join(root, r)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
    git(dir, 'worktree', 'add', '-q', '-b', 'PAY-1', path.join(root, '.worktrees/PAY-1', r))
  }
  const ctx = await launch(root)
  const errors: string[] = []
  ctx.page.on('pageerror', (e) => errors.push(e.message))
  try {
    const { page, app } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.getByRole('button', { name: 'Importar 1 tarefa' }).click()
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    await page.getByRole('button', { name: 'Tarefa PAY-1' }).click()
    await expect(page.getByRole('complementary', { name: 'Detalhes da tarefa' })).toBeVisible()
    // Formulário de nova tarefa aberto na Central (lê os repos do workspace).
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    await page.getByRole('button', { name: '+ Nova' }).click()

    const other = path.join(base, 'outra')
    await app.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [dir] })) as never
    }, other)
    const bar = page.getByRole('menubar', { name: 'Menu do Kite' })
    await bar.getByRole('menuitem', { name: 'Arquivo', exact: true }).click()
    await bar.getByRole('menuitem', { name: 'Abrir pasta…' }).click()

    await expect(bar).toContainText('outra')
    // A interface continua respondendo: dá para ir ao explorer da pasta nova.
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Explorer/ })
      .click()
    await expect(page.locator(`[data-node-id="${path.join(other, 'README.md')}"]`)).toBeVisible()
    await expect(page.getByText('A interface do Kite encontrou um erro')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await closeWindow(ctx.app).catch(() => {})
    await ctx.cleanup()
  }
})
