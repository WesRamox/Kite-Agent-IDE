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
    expect(await sidebarWidth(page)).toBe(400)
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
    expect(await sidebarWidth(page)).toBe(200)

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
