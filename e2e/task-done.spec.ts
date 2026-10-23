import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { git, launch, makeWorkspace, trashed } from './app'

// Tarefa concluída: marcar e desmarcar (detalhes, Central e menu) e excluir as worktrees.
test('tarefa concluída: marca, desmarca e exclui as worktrees mantendo as branches', async () => {
  test.setTimeout(90_000)
  const base = await makeWorkspace({
    'loja/api/server.ts': 'export const api = 1\n',
    'loja/web/page.tsx': 'export const web = 1\n',
  })
  const root = path.join(base, 'loja')
  const folder = path.join(root, '.worktrees/PAY-1')
  for (const r of ['api', 'web']) {
    const dir = path.join(root, r)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
    git(dir, 'worktree', 'add', '-q', '-b', 'PAY-1', path.join(folder, r))
  }
  await writeFile(path.join(folder, 'TASK.md'), '# Checkout com Pix\n')
  const ctx = await launch(root)
  try {
    const { page, app } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.getByRole('button', { name: 'Importar 1 tarefa' }).click()
    const central = () =>
      page
        .getByRole('navigation', { name: 'Atividades' })
        .getByRole('button', { name: /^Central de atenção/ })
        .click()
    const item = page.getByRole('button', { name: 'Tarefa Checkout com Pix' })

    // Pelos detalhes da tarefa aberta.
    await central()
    await item.click()
    const details = page.getByRole('complementary', { name: 'Detalhes da tarefa' })
    await details.getByRole('button', { name: 'Marcar como concluída', exact: true }).click()
    await expect(details.getByText('Concluída', { exact: true })).toBeVisible()
    await details.getByRole('button', { name: 'Desmarcar', exact: true }).click()
    await expect(
      details.getByRole('button', { name: 'Marcar como concluída', exact: true }),
    ).toBeVisible()

    // Pela Central: sai dos grupos e vai para "Concluídas"; desmarcar traz de volta.
    await central()
    await item.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Marcar como concluída', exact: true }).click()
    await expect(item).toHaveCount(0)
    await page.getByRole('button', { name: /Concluídas · 1/ }).click()
    await page.getByRole('button', { name: 'Desmarcar Checkout com Pix como concluída' }).click()
    await expect(item).toBeVisible()
    await expect(page.getByRole('button', { name: /Concluídas/ })).toHaveCount(0)

    // Excluir as worktrees: a pasta da tarefa (só com o TASK.md) vai para a lixeira.
    await item.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Marcar como concluída', exact: true }).click()
    // A seção lembra se estava aberta, como a das escondidas.
    const section = page.getByRole('button', { name: /Concluídas · 1/ })
    if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click()
    await page.getByRole('button', { name: 'Excluir as worktrees de Checkout com Pix' }).click()
    await expect(page.getByText('2 worktrees excluídas e a pasta da tarefa')).toBeVisible()
    expect(existsSync(path.join(folder, 'api'))).toBe(false)
    expect(existsSync(path.join(folder, 'web'))).toBe(false)
    expect(await trashed(app)).toEqual([folder])
    await expect(page.getByRole('button', { name: /Concluídas/ })).toHaveCount(0)
    for (const r of ['api', 'web']) {
      expect(git(path.join(root, r), 'branch', '--list', 'PAY-1')).toContain('PAY-1')
    }
  } finally {
    await ctx.cleanup()
  }
})
