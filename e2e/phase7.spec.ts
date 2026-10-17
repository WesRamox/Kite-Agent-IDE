import { execFileSync } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { closeWindow, launch, makeWorkspace, setConfirmAnswer } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

async function connect(page: Page, userData: string): Promise<string> {
  await page.getByRole('button', { name: 'Conectar Claude Code' }).click()
  await page.getByRole('button', { name: 'Conectar', exact: true }).first().click()
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
  // "Conectar agentes" abre numa janela sobreposta: fecha antes de seguir.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const settings = JSON.parse(await readFile(path.join(userData, 'claude-settings.json'), 'utf8'))
  return settings.hooks.Stop[0].hooks[0].command as string
}

test('central de atenção: quem espera, Ctrl+J, responder no terminal e retomar aqui', async () => {
  test.skip(process.platform === 'win32', 'comando do hook é POSIX; Windows verificar depois')
  test.setTimeout(90_000)
  const ws = await makeWorkspace({ 'README.md': '# loja\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  // `claude` falso no PATH: grava os argumentos para conferir o "Retomar aqui".
  const bin = await mkdtemp(path.join(tmpdir(), 'kite-bin-'))
  await writeFile(path.join(bin, 'claude'), '#!/bin/sh\necho "$@" > resumed.txt\n', { mode: 0o755 })
  const ctx = await launch(ws, { userData, env: { PATH: `${bin}:${process.env['PATH'] ?? ''}` } })
  try {
    const { page, app } = ctx
    await app.evaluate(({ Notification }) => {
      Notification.prototype.show = () => {}
    })
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await expect(page.locator('[role="tree"]')).toBeVisible()
    const command = await connect(page, userData)
    const fire = (payload: Record<string, unknown>) =>
      execFileSync('/bin/sh', ['-c', command], { input: JSON.stringify({ cwd: ws, ...payload }) })

    // B: sessão fora do Kite, terminou o turno (espera há mais tempo).
    fire({ session_id: 'sess-b', hook_event_name: 'UserPromptSubmit', prompt: 'Login social' })
    fire({
      session_id: 'sess-b',
      hook_event_name: 'Stop',
      last_assistant_message: 'Sigo para o Apple?',
    })

    // A: sessão num terminal do Kite (o hook roda lá dentro e herda KITE_PTY_ID).
    await writeFile(
      path.join(ws, 'ev.json'),
      JSON.stringify({
        session_id: 'sess-a',
        cwd: ws,
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: { command: 'pnpm prisma migrate dev' },
      }),
    )
    await page.keyboard.press(`${mod}+Backquote`)
    await page.locator('.xterm:visible').click()
    await page.keyboard.type(`sh -c "${command}" < ev.json`)
    await page.keyboard.press('Enter')

    // C: trabalhando.
    fire({ session_id: 'sess-c', hook_event_name: 'UserPromptSubmit', prompt: 'Alerta de fila' })
    fire({
      session_id: 'sess-c',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(ws, 'infra', 'queue.tf') },
    })

    await page.locator('footer').getByRole('button', { name: '● 2 esperando você' }).click()
    const waiting = page.getByRole('region', { name: 'Esperando você' })
    await expect(waiting.getByRole('article')).toHaveCount(2)
    await expect(waiting.getByRole('article').first()).toContainText('Login social')
    await expect(waiting.getByRole('article').first()).toContainText('“Sigo para o Apple?”')
    await expect(waiting.getByRole('article').first()).toContainText('rodando fora do Kite')
    const cardA = waiting.getByRole('article').nth(1)
    await expect(cardA).toContainText('Quer executar · Bash')
    await expect(cardA).toContainText('pnpm prisma migrate dev')
    await expect(cardA.getByRole('button', { name: 'Responder no terminal' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Trabalhando' })).toContainText(
      'Editando infra/queue.tf',
    )

    // Sidebar da Central agrupada (o clique na status bar já mostrou a view).
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByRole('group', { name: 'Esperando você' })).toContainText('2')
    await expect(sidebar.getByRole('group', { name: 'Trabalhando' })).toContainText(
      'Alerta de fila',
    )

    // Ctrl+J: primeiro quem espera há mais tempo (B, só destaca); depois A, que vai ao terminal.
    await page.getByRole('heading', { name: 'Precisa de você' }).click()
    await page.keyboard.press(`${mod}+j`)
    await expect(sidebar.getByRole('button', { name: 'Tarefa Login social' })).toHaveClass(
      /bg-surface-3/,
    )
    await page.keyboard.press(`${mod}+j`)
    await expect(page.locator('.dv-tab.dv-active-tab', { hasText: 'Terminal 1' })).toBeVisible()

    // Responder: o agente volta a trabalhar e sai de "Esperando".
    fire({ session_id: 'sess-a', hook_event_name: 'PostToolUse', tool_name: 'Bash' })
    await expect(page.locator('footer')).toContainText('● 1 esperando você')

    // Retomar aqui (sessão B ainda aberta lá fora: confirma e abre uma segunda cópia).
    await page.locator('footer').getByRole('button', { name: '● 1 esperando você' }).click()
    await setConfirmAnswer(app, 0)
    await waiting.getByRole('button', { name: 'Retomar aqui' }).click()
    await expect(page.locator('.dv-tab', { hasText: 'Claude (retomado)' })).toBeVisible()
    await expect
      .poll(() => readFile(path.join(ws, 'resumed.txt'), 'utf8').catch(() => ''))
      .toBe('--resume sess-b\n')

    // Ao reabrir com o Claude Code conectado, o app abre na sidebar da Central; a Central em si
    // (janela sobreposta) só abre quando pedida.
    await closeWindow(app)
    const again = await launch(ws, { userData, keepWorkspace: true })
    try {
      await expect(again.page.getByRole('complementary')).toContainText('Tarefas')
      await expect(again.page.getByRole('dialog')).toHaveCount(0)
      await again.page.keyboard.press(`${mod}+j`)
      await expect(again.page.getByRole('dialog', { name: 'Central de atenção' })).toBeVisible()
    } finally {
      await again.cleanup()
    }
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
    await rm(bin, { recursive: true, force: true })
  }
})
