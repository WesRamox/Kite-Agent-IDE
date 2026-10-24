import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { launch, makeWorkspace } from './app'

type Box = { x: number; y: number; width: number; height: number }
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
// Caixa de um elemento visível (o Playwright devolve null se ele não estiver na tela).
async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  if (!b) throw new Error('elemento fora da tela')
  return b
}
const inside = (a: Box, b: Box) =>
  a.x >= b.x - 1 &&
  a.y >= b.y - 1 &&
  a.x + a.width <= b.x + b.width + 1 &&
  a.y + a.height <= b.y + b.height + 1

// Elemento do topo num ponto da janela.
const topAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return {
        inCanvas: Boolean(el?.closest('.kite-canvas')),
        inMenu: Boolean(el?.closest('[role="menu"]')),
      }
    },
    [x, y] as const,
  )

// Cor de um pixel da janela de verdade (pega o que o webview desenha, que o DOM não mostra).
async function isWhiteAt(app: ElectronApplication, x: number, y: number): Promise<boolean> {
  const [b = 0, g = 0, r = 0] = await app.evaluate(
    async ({ BrowserWindow }, [x, y]) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return []
      const img = await win.webContents.capturePage({ x, y, width: 1, height: 1 })
      return [...img.toBitmap().subarray(0, 3)]
    },
    [Math.round(x), Math.round(y)] as const,
  )
  return r > 240 && g > 240 && b > 240
}

async function openCanvas(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await expect(page.locator('[role="tree"]')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Atividades' })
    .getByRole('button', { name: 'Quadro' })
    .click()
}

test('o quadro não passa por cima do resto do app', async () => {
  test.setTimeout(120_000)
  const ctx = await launch(await makeWorkspace({ 'README.md': '# app\n' }))
  try {
    const { page, app } = ctx
    await openCanvas(page)
    await page.getByRole('button', { name: 'Adicionar o primeiro bloco' }).click()
    await page.getByRole('menuitem', { name: /^Navegador/ }).click()
    const webview = page.locator('.react-flow__node-browser webview')
    await expect(webview).toBeVisible()
    // Página branca para enxergar o webview nos pixels.
    await webview.evaluate((w) =>
      (w as unknown as { loadURL: (u: string) => Promise<void> }).loadURL(
        'data:text/html,<body style="background:#fff">',
      ),
    )
    const wv = await box(webview)
    const center = { x: wv.x + wv.width / 2, y: wv.y + wv.height / 2 }
    await expect.poll(() => isWhiteAt(app, center.x, center.y)).toBe(true)

    // Outra aba na frente, no mesmo grupo (um arquivo aberto no editor): o navegador do quadro
    // some junto.
    await page.locator('[data-node-id$="README.md"]').click()
    await expect(page.locator('.dv-tab.dv-active-tab', { hasText: 'README.md' })).toBeVisible()
    await expect.poll(() => isWhiteAt(app, center.x, center.y)).toBe(false)

    // Bloco arrastado para cima da sidebar: é cortado na borda do quadro.
    await page.locator('.dv-tab', { hasText: 'Quadro' }).click()
    const header = await box(page.locator('.react-flow__node-browser header'))
    const tree = await box(page.locator('[role="tree"]'))
    await page.mouse.move(header.x + 40, header.y + header.height / 2)
    await page.mouse.down()
    await page.mouse.move(tree.x + 20, header.y + header.height / 2, { steps: 20 })
    await page.mouse.up()
    const spot = { x: tree.x + tree.width / 2, y: tree.y + 60 }
    expect((await topAt(page, spot.x, spot.y)).inCanvas).toBe(false)
    expect(await isWhiteAt(app, spot.x, spot.y)).toBe(false)

    // Shift+clique na aba não solta o quadro numa janela flutuante.
    await page.keyboard.down('Shift')
    await page.locator('.dv-tab', { hasText: 'Quadro' }).click()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(300)
    await expect(page.locator('.dv-resize-container')).toHaveCount(0)

    // Uma camada do dockview com z-index alto (como as de arraste) fica abaixo do menu do app.
    await page.evaluate(() => {
      const layer = document.createElement('div')
      layer.style.cssText = 'position:absolute;inset:0;z-index:999'
      document.querySelector('.dv-dockview')?.append(layer)
    })
    await page
      .locator('[role="tree"] [draggable="true"]')
      .first()
      .click({ button: 'right', position: { x: tree.width - 20, y: 8 } })
    const menu = await box(page.getByRole('menu'))
    const dock = await box(page.locator('.dv-dockview').first())
    const x = Math.max(menu.x, dock.x) + 10
    expect(x).toBeLessThan(menu.x + menu.width)
    expect((await topAt(page, x, menu.y + 10)).inMenu).toBe(true)
    await page.keyboard.press('Escape')
  } finally {
    await ctx.cleanup()
  }
})

test('quadro estreito: a barra de workflows não fica por baixo do "+" e os menus cabem', async () => {
  const ctx = await launch(await makeWorkspace({ 'README.md': '# app\n' }))
  try {
    const { page, app } = ctx
    await openCanvas(page)
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.unmaximize()
      win?.setSize(760, 600)
    })
    // Sidebar no máximo: sobra pouco para o quadro.
    await page.getByRole('separator').first().focus()
    await page.keyboard.press('End')
    const canvas = page.locator('.kite-canvas')
    await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeLessThan(360)
    const area = await box(canvas)

    const workflows = page.getByRole('button', { name: 'Workflows desta pasta' })
    const add = page.getByRole('button', { name: 'Adicionar bloco' })
    expect(intersects(await box(workflows), await box(add))).toBe(false)

    await add.click()
    const addMenu = page.getByRole('menu', { name: 'Adicionar ao quadro' })
    await expect(addMenu).toBeVisible()
    expect(inside(await box(addMenu), area)).toBe(true)
    await add.click()
    await expect(addMenu).toBeHidden()

    await workflows.click()
    const list = page.getByRole('menu').first()
    await expect(list).toBeVisible()
    expect(inside(await box(list), area)).toBe(true)
  } finally {
    await ctx.cleanup()
  }
})
