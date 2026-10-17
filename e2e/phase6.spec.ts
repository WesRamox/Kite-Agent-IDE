import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test, type ElectronApplication } from '@playwright/test'
import { closeWindow, launch, makeWorkspace } from './app'

const run = promisify(execFile)

// Um hook do Orca já instalado: precisa sobreviver a conectar e remover.
const ORIGINAL = {
  theme: 'dark-ansi',
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: '/home/u/.orca/claude-hook.sh', timeout: 10 }] }],
  },
}

async function recordNotifications(app: ElectronApplication) {
  await app.evaluate(({ Notification }) => {
    const g = globalThis as unknown as { __notes: { title: string; body: string }[] }
    g.__notes = []
    Notification.isSupported = () => true
    Notification.prototype.show = function (this: { title: string; body: string }) {
      g.__notes.push({ title: this.title, body: this.body })
    }
  })
}

const notes = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { __notes: { title: string }[] }).__notes)

// Executa o comando que o Kite gravou no settings.json, como o Claude Code faria.
async function fireHook(command: string, payload: Record<string, unknown>) {
  const child = run('/bin/sh', ['-c', command], { timeout: 5000 })
  child.child.stdin?.end(JSON.stringify({ session_id: 'sess-1', cwd: '/tmp/loja', ...payload }))
  const { stdout } = await child
  expect(stdout).toBe('') // nada vira contexto do agente
}

test('hooks do Claude Code: conectar, acompanhar uma sessão externa e remover', async () => {
  test.skip(process.platform === 'win32', 'comando do hook é POSIX; Windows verificar depois')
  const ws = await makeWorkspace({ 'a.txt': 'a\n' })
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const home = await mkdtemp(path.join(tmpdir(), 'kite-home-'))
  const settingsPath = path.join(home, '.claude', 'settings.json')
  await mkdir(path.dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, JSON.stringify(ORIGINAL, null, 2))
  const env = { KITE_CLAUDE_SETTINGS: settingsPath }

  const ctx = await launch(ws, { userData, env })
  try {
    const { page, app } = ctx
    await recordNotifications(app)
    await page.getByRole('button', { name: 'Conectar Claude Code' }).click()
    await expect(
      page.getByRole('heading', { name: 'Saber quando um agente precisa de você' }),
    ).toBeVisible()
    await expect(page.getByRole('group', { name: 'Claude Code', exact: true })).toContainText(
      'Não conectado',
    )
    await page.getByRole('button', { name: 'Conectar', exact: true }).first().click()
    await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Claude Code conectado' })).toBeVisible()

    const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as {
      theme: string
      hooks: Record<string, { hooks: { command: string }[] }[]>
    }
    expect(settings.theme).toBe('dark-ansi')
    expect(settings.hooks['Stop']?.[0]).toEqual(ORIGINAL.hooks.Stop[0])
    const command = settings.hooks['PermissionRequest']?.[0]?.hooks[0]?.command ?? ''
    expect(command).toContain('kite-hook.sh')

    const sessions = page.getByRole('region', { name: 'Sessões detectadas' })
    await fireHook(command, { hook_event_name: 'UserPromptSubmit', prompt: 'roda a migration' })
    await expect(sessions.getByText('trabalhando')).toBeVisible()
    await expect(sessions.getByText('Primeiro pedido: “roda a migration”')).toBeVisible()

    const t0 = Date.now()
    await fireHook(command, {
      hook_event_name: 'PermissionRequest',
      tool_name: 'Bash',
      tool_input: { command: 'pnpm prisma migrate dev' },
    })
    await expect(sessions.getByText('pede permissão')).toBeVisible()
    expect(Date.now() - t0).toBeLessThan(2000)
    await expect(page.getByText('● 1 esperando você')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Central de atenção, 1 esperando' }),
    ).toBeVisible()
    await expect
      .poll(() => notes(app))
      .toEqual([expect.objectContaining({ title: 'Claude pede permissão' })])

    await fireHook(command, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: '/tmp/loja/api/src/pix.ts' },
    })
    await expect(sessions.getByText('trabalhando')).toBeVisible()
    await expect(sessions.getByText('Editou api/src/pix.ts.')).toBeVisible()
    await expect(page.getByText('● 1 esperando você')).toBeHidden()

    await fireHook(command, {
      hook_event_name: 'Stop',
      last_assistant_message: 'Sigo para o webhook?',
    })
    await expect(sessions.getByText('sua vez')).toBeVisible()

    // Fechar e reabrir: a sessão volta com o último estado (lido do spool).
    await closeWindow(app)
    const again = await launch(ws, { userData, env, keepWorkspace: true })
    try {
      await again.page.getByRole('button', { name: 'Claude Code conectado' }).click()
      const region = again.page.getByRole('region', { name: 'Sessões detectadas' })
      await expect(region.getByText('sua vez')).toBeVisible()
      await expect(again.page.getByText('● 1 esperando você')).toBeVisible()

      await again.page.getByRole('button', { name: 'Remover' }).click()
      await expect(
        again.page.getByRole('group', { name: 'Claude Code', exact: true }),
      ).toContainText('Não conectado')
      expect(JSON.parse(await readFile(settingsPath, 'utf8'))).toEqual(ORIGINAL)
    } finally {
      await again.cleanup()
    }
  } finally {
    await ctx.cleanup()
    await rm(userData, { recursive: true, force: true })
    await rm(home, { recursive: true, force: true })
  }
})
