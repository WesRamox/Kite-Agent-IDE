import path from 'node:path'
import { expect, test } from '@playwright/test'
import { launch } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

// Critério de aceite da Fase 1: abrir um repo real (este) sem travar a UI.
test('abre este repositório e navega por ele', async () => {
  const repo = path.join(__dirname, '..')
  const ctx = await launch(repo, { keepWorkspace: true })
  try {
    const page = ctx.page
    const start = Date.now()
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await expect(page.locator(`[data-node-id="${path.join(repo, 'src')}"]`)).toBeVisible()
    await expect(page.locator(`[data-node-id="${path.join(repo, 'node_modules')}"]`)).toHaveCount(0)

    await page.keyboard.press(`${mod}+p`)
    await page.getByPlaceholder('Buscar arquivo pelo nome').fill('ipccontract')
    await page.keyboard.press('Enter')
    await expect(page.locator('.monaco-editor:visible .view-lines')).toContainText(
      'Fonte única de verdade de todos os canais IPC',
    )
    expect(Date.now() - start).toBeLessThan(10_000)

    await page.screenshot({ path: 'test-results/real-repo.png' })
  } finally {
    await ctx.cleanup()
  }
})
