import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'

// Busca nos arquivos da tarefa aberta (Ctrl/Cmd+Shift+F), só nas worktrees dela.
test('busca na tarefa: acha nas worktrees, ignora o resto e abre o arquivo na linha', async () => {
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
  await writeFile(path.join(folder, 'api/pix.ts'), '// cobrança\n\nexport const pix = 1\n')
  await writeFile(path.join(folder, 'web/checkout.tsx'), 'export const Pix = () => null\n')
  // Fora da tarefa: no clone principal, não numa worktree dela.
  await writeFile(path.join(root, 'api/fora.ts'), 'pix fora da tarefa\n')
  const ctx = await launch(root)
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.getByRole('button', { name: 'Importar 1 tarefa' }).click()

    // Sem tarefa aberta, a busca pede uma.
    await page.keyboard.press('ControlOrMeta+Shift+F')
    await expect(page.getByText('Abra uma tarefa para buscar')).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    await page.getByRole('button', { name: 'Tarefa PAY-1' }).click()
    // Abrir a tarefa leva a barra lateral para o explorer: o atalho vem depois.
    await expect(page.getByRole('complementary', { name: 'Detalhes da tarefa' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+Shift+F')
    const input = page.getByRole('textbox', { name: 'Buscar na tarefa' })
    await expect(input).toBeFocused()
    await input.fill('pix')
    await expect(page.getByText('2 resultados em 2 arquivos')).toBeVisible()
    await expect(page.getByRole('button', { name: /fora\.ts/ })).toHaveCount(0)

    // Maiúsculas: só o "pix" minúsculo.
    await page.getByRole('button', { name: 'Diferenciar maiúsculas e minúsculas' }).click()
    await expect(page.getByText('1 resultado em 1 arquivo')).toBeVisible()

    // Abre o arquivo com a ocorrência selecionada (o cursor fica no fim dela).
    await page.getByRole('button', { name: 'Abrir pix.ts na linha 3' }).click()
    await expect(page.locator('.dv-tab', { hasText: 'pix.ts' })).toBeVisible()
    await expect(page.getByText('Ln 3, Col 17')).toBeVisible()
  } finally {
    await ctx.cleanup()
  }
})
