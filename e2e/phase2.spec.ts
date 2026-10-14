import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { closeWindow, launch, makeWorkspace, type Launched } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

let ctx: Launched

test.beforeEach(async () => {
  ctx = await launch(await makeWorkspace({ 'README.md': '# teste\n' }))
})

test.afterEach(async () => {
  await ctx.cleanup()
})

const terminals = (page: Page) => page.locator('.xterm:visible')
const fileIn = (name: string) => path.join(ctx.workspace, name)
const read = (file: string) => readFile(file, 'utf8').catch(() => '')

async function openWorkspace(page: Page) {
  await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await expect(page.locator('[role="tree"]')).toBeVisible()
}

async function run(page: Page, index: number, command: string) {
  await terminals(page).nth(index).click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
}

test('Ctrl+` abre um shell real na pasta, com env limpo', async () => {
  await openWorkspace(ctx.page)
  await ctx.page.keyboard.press(`${mod}+Backquote`)
  await expect(terminals(ctx.page)).toHaveCount(1)
  await run(ctx.page, 0, 'pwd > cwd.txt; echo "$TERM|$ELECTRON_RENDERER_URL|" > env.txt')
  await expect.poll(() => read(fileIn('cwd.txt'))).toBe(`${ctx.workspace}\n`)
  await expect.poll(() => read(fileIn('env.txt'))).toBe('xterm-256color||\n')
})

test('4 terminais em split e resize sincronizado com o PTY', async () => {
  const page = ctx.page
  await openWorkspace(page)
  await page.keyboard.press(`${mod}+Backquote`)
  await page.getByRole('button', { name: 'Dividir à direita' }).first().click()
  await page.getByRole('button', { name: 'Dividir abaixo' }).first().click()
  await page.getByRole('button', { name: 'Dividir abaixo' }).last().click()
  await expect(terminals(page)).toHaveCount(4)

  for (let i = 0; i < 4; i++) await run(page, i, `stty size > size${i}.txt`)
  for (let i = 0; i < 4; i++) {
    await expect.poll(() => read(fileIn(`size${i}.txt`))).toMatch(/^\d+ \d+\n$/)
  }

  const before = await read(fileIn('size0.txt'))
  await ctx.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setSize(1000, 700),
  )
  await page.waitForTimeout(500)
  await run(page, 0, 'stty size > after.txt')
  await expect.poll(() => read(fileIn('after.txt'))).toMatch(/^\d+ \d+\n$/)
  const after = await read(fileIn('after.txt'))
  expect(after).not.toBe(before)
  const [rows, cols] = after.trim().split(' ').map(Number)
  expect(rows).toBeGreaterThan(2)
  expect(cols).toBeGreaterThan(10)
})

test('saída intensa não trava a UI', async () => {
  const page = ctx.page
  await openWorkspace(page)
  await page.keyboard.press(`${mod}+Backquote`)
  await run(
    page,
    0,
    `node -e "let i=0;const t=setInterval(()=>{for(let k=0;k<50;k++)console.log('linha',++i,'x'.repeat(80));if(i>=20000){clearInterval(t);require('fs').writeFileSync('done.txt','ok')}},1)"`,
  )
  // Enquanto o processo despeja saída, a UI continua respondendo.
  await page.getByRole('button', { name: 'Git', exact: true }).click()
  await page.getByRole('button', { name: 'Explorer' }).click()
  await expect(page.locator('[role="tree"]')).toBeVisible()
  await expect.poll(() => read(fileIn('done.txt')), { timeout: 30_000 }).toBe('ok')
})

test('busca, colar e encerrar o shell', async () => {
  const page = ctx.page
  await openWorkspace(page)
  await page.keyboard.press(`${mod}+Backquote`)
  await terminals(page).first().click()

  await page.keyboard.press(`${mod}+f`)
  await expect(page.getByPlaceholder('Buscar no terminal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByPlaceholder('Buscar no terminal')).toHaveCount(0)

  await ctx.app.evaluate(({ clipboard }) => clipboard.writeText('echo colado > paste.txt'))
  await terminals(page).first().click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+v' : 'Control+Shift+v')
  await page.keyboard.press('Enter')
  await expect.poll(() => read(fileIn('paste.txt'))).toBe('colado\n')

  await run(page, 0, 'exit')
  await expect(terminals(page)).toHaveCount(0)
})

test('mantém o histórico ao fechar e reabrir, sem processos órfãos', async () => {
  const page = ctx.page
  await openWorkspace(page)
  await page.keyboard.press(`${mod}+Backquote`)
  await run(page, 0, 'echo MARCADOR-$((40+2)); echo $$ > shell.pid')
  await run(page, 0, `sh -c 'echo $$ > child.pid; exec sleep 1000'`)
  await expect.poll(() => read(fileIn('child.pid'))).toMatch(/^\d+\n$/)
  const pids = [await read(fileIn('shell.pid')), await read(fileIn('child.pid'))].map((p) =>
    Number(p.trim()),
  )

  await closeWindow(ctx.app)

  // Nenhum processo do terminal sobrevive ao fechamento.
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  await expect.poll(() => pids.filter(alive), { timeout: 10_000 }).toEqual([])

  // O scrollback foi salvo no perfil.
  const sessionsDir = path.join(ctx.userData, 'terminal-sessions')
  const [file] = await readdir(sessionsDir)
  const saved = await readFile(path.join(sessionsDir, file ?? ''), 'utf8')
  expect(saved).toContain('MARCADOR-42')

  // Reabre com o mesmo perfil: o terminal volta com o histórico.
  const again = await launch(ctx.workspace, { userData: ctx.userData, keepWorkspace: true })
  try {
    await again.page.getByRole('button', { name: path.basename(ctx.workspace) }).click()
    await expect(again.page.locator('.dv-tab', { hasText: 'Terminal 1' })).toBeVisible()
    await expect(terminals(again.page)).toHaveCount(1)
    // Fecha de novo: o que foi restaurado aparece no novo scrollback salvo.
    await closeWindow(again.app)
    const resaved = await readFile(path.join(sessionsDir, file ?? ''), 'utf8')
    expect(resaved).toContain('MARCADOR-42')
    expect(resaved).toContain('sessão restaurada')
  } finally {
    await again.cleanup()
  }
})
