import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { launch, makeWorkspace } from './app'

test('interface que cai é recarregada e o motivo fica no log', async () => {
  const ws = await makeWorkspace({ 'a.ts': 'export const a = 1\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(ws, { userData })
  try {
    const page = ctx.page
    await expect(page.getByRole('heading', { name: 'Kite' })).toBeVisible()
    await page.waitForTimeout(500)
    await ctx.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer(),
    )
    await new Promise((r) => setTimeout(r, 1500))
    // O main recarrega a janela: a tela inicial volta (conferido pela própria janela, porque a
    // página do Playwright morre junto com a interface derrubada).
    await expect
      .poll(
        () =>
          ctx.app.evaluate(async ({ BrowserWindow }) => {
            const wc = BrowserWindow.getAllWindows()[0]?.webContents
            if (!wc || wc.isCrashed()) return ''
            try {
              const h1 = wc.executeJavaScript('document.querySelector("h1")?.textContent')
              const late = new Promise((r) => setTimeout(() => r(''), 1000))
              return String(await Promise.race([h1, late]))
            } catch {
              return ''
            }
          }),
        { timeout: 15_000 },
      )
      .toBe('Kite')
    await expect
      .poll(() => readFile(path.join(userData, 'logs', 'main.log'), 'utf8').catch(() => ''))
      .toContain('a interface caiu')
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
  }
})
