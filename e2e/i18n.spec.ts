import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { closeWindow, launch, makeWorkspace } from './app'

test('idioma: inglês num sistema em inglês, troca ao vivo para português e lembra ao reabrir', async () => {
  const ws = await makeWorkspace({ 'a.ts': 'export const a = 1\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(ws, { userData, lang: 'en-US' })
  try {
    const page = ctx.page
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByText('An IDE for working with AI agents.')).toBeVisible()
    const bar = page.getByRole('menubar', { name: 'Kite menu' })
    await expect(bar.getByRole('menuitem', { name: 'File', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Open folder' }).first().click()
    await expect(page.locator('footer')).toContainText('Connect Claude Code')
    await page
      .getByRole('navigation', { name: 'Activities' })
      .getByRole('button', { name: 'Attention center' })
      .click()
    await expect(page.getByRole('complementary').first()).toContainText('Tasks')
    await expect(page.getByRole('button', { name: '+ New' })).toBeVisible()

    // Settings → Português: a interface muda na hora, sem reabrir.
    await page.keyboard.press('Control+Comma')
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    await page
      .getByRole('radiogroup', { name: 'Interface language' })
      .getByRole('radio', { name: 'Português (Brasil)' })
      .check()
    await expect(page.getByRole('heading', { name: 'Configurações', level: 1 })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.getByRole('menubar', { name: 'Menu do Kite' })).toContainText('Arquivo')
    await expect(page.locator('footer')).toContainText('Conectar Claude Code')
    await expect
      .poll(async () => JSON.parse(await readFile(path.join(userData, 'settings.json'), 'utf8')))
      .toMatchObject({ language: 'pt-BR' })

    // A escolha vale mais que o idioma do sistema ao reabrir.
    await closeWindow(ctx.app)
    const again = await launch(ws, { userData, keepWorkspace: true, lang: 'en-US' })
    try {
      await expect(again.page.getByText('IDE para trabalhar com agentes de IA.')).toBeVisible()
    } finally {
      await again.cleanup()
    }
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
  }
})
