import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { closeWindow, launch, makeWorkspace } from './app'

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('tema padrão Kite, troca para Claro e persiste ao reabrir', async () => {
  const ws = await makeWorkspace({ 'a.ts': 'export const a = 1\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(ws, { userData })
  try {
    const page = ctx.page
    await expect(page).toHaveTitle('Kite')
    await expect(page.getByRole('heading', { name: 'Kite' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'kite')
    expect(await bodyBg(page)).toBe('rgb(17, 17, 18)') // #111112

    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.locator(`[data-node-id="${path.join(ws, 'a.ts')}"]`).click()
    await page.keyboard.press('Control+Backquote')
    await expect(page.locator('.xterm:visible')).toHaveCount(1)

    await page.getByRole('button', { name: 'Tema' }).click()
    await page.getByRole('menuitemradio', { name: 'Claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('html')).toHaveAttribute('data-theme-kind', 'light')
    await expect.poll(() => bodyBg(page)).toBe('rgb(255, 255, 255)')
    // Editor e terminal acompanham o tema.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.monaco-editor-background') as Element)
              .backgroundColor,
        ),
      )
      .toBe('rgb(255, 255, 255)')
    await expect
      .poll(() => ctx.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
      .toBe('light')
    await expect
      .poll(
        async () => JSON.parse(await readFile(path.join(userData, 'settings.json'), 'utf8')).theme,
      )
      .toBe('light')

    await closeWindow(ctx.app)
    const again = await launch(ws, { userData, keepWorkspace: true })
    try {
      await expect(again.page.locator('html')).toHaveAttribute('data-theme', 'light')
      expect(await bodyBg(again.page)).toBe('rgb(255, 255, 255)')
    } finally {
      await again.cleanup()
    }
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
  }
})
