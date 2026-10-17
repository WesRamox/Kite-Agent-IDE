import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { closeWindow, launch, makeWorkspace } from './app'

const sidebarWidth = (page: Page) =>
  page.evaluate(() => {
    const handle = document.querySelector('[aria-label="Largura da barra lateral"]')
    return Math.round(handle?.parentElement?.getBoundingClientRect().width ?? 0)
  })

test('sidebar ajustável: arrastar, limites, teclado, duplo clique e largura mantida ao reabrir', async () => {
  const ws = await makeWorkspace({ 'a.ts': 'export const a = 1\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(ws, { userData })
  try {
    const page = ctx.page
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.locator(`[data-node-id="${path.join(ws, 'a.ts')}"]`).click()
    await expect(page.locator('.monaco-editor').first()).toBeVisible()
    expect(await sidebarWidth(page)).toBe(288)

    const handle = page.getByRole('separator', { name: 'Largura da barra lateral' })
    const box = await handle.boundingBox()
    if (!box) throw new Error('sem a borda da sidebar')
    const y = box.y + box.height / 2
    const drag = async (from: number, to: number) => {
      await page.mouse.move(from, y)
      await page.mouse.down()
      await page.mouse.move(to, y, { steps: 5 })
      await page.mouse.up()
    }
    const x = box.x + box.width / 2
    await drag(x, x + 112)
    await expect.poll(() => sidebarWidth(page)).toBe(400)
    // O editor acompanha a nova largura.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.round(document.querySelector('.monaco-editor')?.getBoundingClientRect().left ?? 0),
        ),
      )
      .toBeGreaterThan(400)

    // Limites: não passa de 200 px nem de 640 px.
    await drag(x + 112, 20)
    await expect.poll(() => sidebarWidth(page)).toBe(200)

    // Teclado e duplo clique.
    await handle.focus()
    await page.keyboard.press('ArrowRight')
    await expect(handle).toHaveAttribute('aria-valuenow', '216')
    await handle.dblclick()
    await expect(handle).toHaveAttribute('aria-valuenow', '288')
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '640')
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    expect(await sidebarWidth(page)).toBe(232)

    await closeWindow(ctx.app)
    const again = await launch(ws, { userData, keepWorkspace: true })
    try {
      await expect.poll(() => sidebarWidth(again.page)).toBe(232)
    } finally {
      await again.cleanup()
    }
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
  }
})

test('barra de menus: abrir, trocar com o mouse, teclado, tema, barra lateral e sobre', async () => {
  const ws = await makeWorkspace({ 'a.ts': 'export const a = 1\n' })
  const ctx = await launch(ws)
  try {
    const page = ctx.page
    const bar = page.getByRole('menubar', { name: 'Menu do Kite' })
    const top = (name: string) => bar.getByRole('menuitem', { name, exact: true })
    await expect(
      bar.getByRole('menuitem', { name: /^(Arquivo|Ver|Tarefa|Terminal|Ajuda)$/ }),
    ).toHaveCount(5)

    // Sem pasta, as ações que precisam dela ficam desabilitadas.
    await top('Arquivo').click()
    await expect(bar.getByRole('menuitem', { name: 'Salvar' })).toBeDisabled()
    // Com um menu aberto, passar o mouse troca de menu.
    await top('Tarefa').hover()
    await expect(bar.getByRole('menuitem', { name: 'Nova tarefa…' })).toBeVisible()
    await expect(bar.getByRole('menuitem', { name: 'Salvar' })).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(bar.getByRole('menu')).toHaveCount(0)

    await top('Arquivo').click()
    await bar.getByRole('menuitem', { name: 'Abrir pasta…' }).click()
    await expect(page.locator(`[data-node-id="${path.join(ws, 'a.ts')}"]`)).toBeVisible()
    await expect(bar).toContainText(path.basename(ws))

    // Tema pelo submenu de Ver.
    await top('Ver').click()
    await bar.getByRole('menuitem', { name: 'Tema' }).hover()
    await bar.getByRole('menuitem', { name: 'Claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // Teclado: seta para a direita troca de menu, Enter executa.
    await top('Ver').click()
    await page.keyboard.press('ArrowRight')
    await expect(bar.getByRole('menuitem', { name: 'Nova tarefa…' })).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Abrir pasta' }).first()).toBeHidden()
    await expect(page.locator('[role="tree"]').first()).toBeVisible()

    // Ocultar a barra lateral pelo menu e pelo Ctrl+B.
    await top('Ver').click()
    await bar.getByRole('menuitem', { name: 'Ocultar barra lateral' }).click()
    await expect(page.locator(`[data-node-id="${path.join(ws, 'a.ts')}"]`)).toBeHidden()
    await page.keyboard.press('Control+b')
    await expect(page.locator(`[data-node-id="${path.join(ws, 'a.ts')}"]`)).toBeVisible()

    // Sobre: diálogo nativo com a versão.
    await top('Ajuda').click()
    await bar.getByRole('menuitem', { name: 'Sobre o Kite' }).click()
    await expect
      .poll(() =>
        ctx.app.evaluate(
          () =>
            (globalThis as unknown as { __lastDialog?: { message: string } }).__lastDialog
              ?.message ?? '',
        ),
      )
      .toMatch(/^Kite \d+\.\d+\.\d+/)
  } finally {
    await ctx.cleanup()
  }
})
