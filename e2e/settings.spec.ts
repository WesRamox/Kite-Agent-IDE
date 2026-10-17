import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { closeWindow, launch, makeWorkspace } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test('configurações: fonte do editor e do terminal, notificações, idioma e persistência', async () => {
  const ws = await makeWorkspace({ 'a.ts': 'export const a = 1\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(ws, { userData })
  try {
    const page = ctx.page
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.locator(`[data-node-id="${path.join(ws, 'a.ts')}"]`).click()
    await expect(page.locator('.monaco-editor').first()).toBeVisible()
    await page.keyboard.press(`${mod}+Backquote`)
    await expect(page.locator('.xterm:visible')).toHaveCount(1)
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('stty size > antes.txt')
    await page.keyboard.press('Enter')
    await expect
      .poll(() => readFile(path.join(ws, 'antes.txt'), 'utf8').catch(() => ''))
      .toMatch(/^\d+ \d+/)
    const [, colsBefore] = (await readFile(path.join(ws, 'antes.txt'), 'utf8')).trim().split(' ')

    // O botão de configurações (no lugar do antigo botão de tema) abre a página.
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: 'Configurações' })
      .click()
    const settings = page.getByRole('heading', { name: 'Configurações', level: 1 })
    await expect(settings).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio')).toHaveCount(6)

    // Idioma: só português por enquanto.
    const language = page.getByRole('radiogroup', { name: 'Idioma da interface' })
    await expect(language.getByRole('radio', { name: 'Português (Brasil)' })).toBeChecked()
    await expect(language.getByRole('radio', { name: 'English' })).toBeDisabled()

    // Fontes: 13 → 15 no editor, 13 → 10 no terminal (inclusive no terminal já aberto).
    const editorFont = page.getByRole('group', { name: 'Fonte do editor' })
    await editorFont.getByRole('button', { name: 'Aumentar fonte do editor' }).click()
    await editorFont.getByRole('button', { name: 'Aumentar fonte do editor' }).click()
    await expect(editorFont).toContainText('15 px')
    const terminalFont = page.getByRole('group', { name: 'Fonte do terminal' })
    // Três passos: com DPI 1 o xterm arredonda a célula para pixels inteiros, e 13 e 12 px dão a
    // mesma largura.
    for (let i = 0; i < 3; i++) {
      await terminalFont.getByRole('button', { name: 'Diminuir fonte do terminal' }).click()
    }
    await expect(terminalFont).toContainText('10 px')

    await page.getByRole('switch', { name: 'Notificações' }).click()
    await expect(page.getByRole('switch', { name: 'Notificações' })).toHaveAttribute(
      'aria-checked',
      'false',
    )

    await expect
      .poll(async () => JSON.parse(await readFile(path.join(userData, 'settings.json'), 'utf8')))
      .toMatchObject({ editorFontSize: 15, terminalFontSize: 10, notifications: false })

    // O editor e o terminal abertos usam as fontes novas.
    // Fecha a janela sobreposta antes de mexer no resto da tela.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('.dv-tab', { hasText: 'a.ts' }).click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.monaco-editor .view-line') as Element)
              .fontSize,
        ),
      )
      .toBe('15px')
    // Terminal: com WebGL o texto vai num canvas, então confere o efeito real: fonte menor,
    // mais colunas no PTY (o fit recalcula e avisa o shell).
    await page.locator('.dv-tab', { hasText: 'Terminal' }).first().click()
    // O terminal recalcula o tamanho ao reaparecer: mede de novo até as colunas aumentarem.
    let n = 0
    await expect
      .poll(async () => {
        const file = `depois-${++n}.txt`
        await page.locator('.xterm:visible').click()
        await page.keyboard.type(`stty size > ${file}`)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(300)
        const out = await readFile(path.join(ws, file), 'utf8').catch(() => '')
        return Number(out.trim().split(' ')[1] ?? 0)
      })
      .toBeGreaterThan(Number(colsBefore))

    // Ctrl+, reabre a página; ao reabrir o app, as configurações continuam.
    await closeWindow(ctx.app)
    const again = await launch(ws, { userData, keepWorkspace: true })
    try {
      await again.page.getByRole('button', { name: 'Abrir pasta' }).first().click()
      await expect(again.page.locator('[role="tree"]').first()).toBeVisible()
      await again.page.locator('[role="tree"]').first().click()
      await again.page.keyboard.press(`${mod}+Comma`)
      await expect(again.page.getByRole('group', { name: 'Fonte do editor' })).toContainText(
        '15 px',
      )
      await expect(again.page.getByRole('switch', { name: 'Notificações' })).toHaveAttribute(
        'aria-checked',
        'false',
      )
    } finally {
      await again.cleanup()
    }
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
  }
})
