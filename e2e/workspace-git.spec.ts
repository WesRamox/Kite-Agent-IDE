import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'

// Workspace que não é um repositório (pasta com vários repos): o painel Git mostra um dos repos
// e, com uma tarefa aberta, as worktrees dela.
test('painel Git num workspace com vários repos segue a tarefa aberta', async () => {
  test.setTimeout(60_000)
  const base = await makeWorkspace({
    'speed/SGE/sge-backend/server.ts': 'export const a = 1\n',
    'speed/Portal/portal-backend/app.ts': 'export const b = 1\n',
  })
  const root = path.join(base, 'speed')
  const repos = { 'sge-backend': 'SGE/sge-backend', 'portal-backend': 'Portal/portal-backend' }
  for (const [name, rel] of Object.entries(repos)) {
    const dir = path.join(root, rel)
    git(dir, 'init', '-q', '-b', 'dev')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
    git(dir, 'worktree', 'add', '-q', '-b', 'TECH-1-x', path.join(root, '.worktrees/TECH-1', name))
  }
  await writeFile(path.join(root, '.worktrees/TECH-1/portal-backend/app.ts'), 'mudou\n')
  const ctx = await launch(root)
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.getByRole('button', { name: 'Importar 1 tarefa' }).click()

    // Sem tarefa: um dos repos do workspace, com a escolha entre eles.
    await page.getByRole('button', { name: 'Git', exact: true }).click()
    await expect(page.getByText('Esta pasta não é um repositório Git.')).toHaveCount(0)
    const picker = page.getByRole('combobox', { name: 'Repositório' })
    await expect(picker.locator('option')).toHaveText(['portal-backend', 'sge-backend'])
    await expect(page.locator('footer')).toContainText('dev')

    // Com a tarefa aberta: as worktrees dela; a do portal tem a mudança.
    await page.keyboard.press('Control+k')
    await page
      .getByRole('dialog', { name: 'Trocar de tarefa' })
      .getByRole('button', { name: /TECH-1/ })
      .first()
      .click()
    // Abrir a tarefa leva ao explorer dela: espera antes de ir ao painel Git.
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText('TECH-1')
    await page.getByRole('button', { name: 'Git', exact: true }).click()
    await expect(picker.locator('option')).toHaveText([
      'portal-backend · TECH-1-x',
      'sge-backend · TECH-1-x',
    ])
    await expect(page.locator('footer')).toContainText('TECH-1-x')
    await expect(page.getByRole('complementary').first()).toContainText('app.ts')
    await picker.selectOption({ label: 'sge-backend · TECH-1-x' })
    await expect(page.getByText('Nenhuma alteração')).toBeVisible()
  } finally {
    await ctx.cleanup()
  }
})
