import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { closeWindow, git, launch, makeWorkspace } from './app'

// Sessões fora de tarefa em "Para revisar": dá para revisar, saem sozinhas quando o que o agente
// editou é commitado e podem ser dispensadas.
test('para revisar: sessão fora de tarefa revisa, sai ao commitar e pode ser dispensada', async () => {
  test.skip(process.platform === 'win32', 'comando do hook é POSIX; Windows verificar depois')
  test.setTimeout(90_000)
  const ws = await makeWorkspace({ 'README.md': '# loja\n', 'app.ts': 'export {}\n' })
  git(ws, 'init', '-q', '-b', 'main')
  git(ws, 'add', '.')
  git(ws, 'commit', '-q', '-m', 'inicial')
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  let ctx = await launch(ws, { userData })
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await expect(page.locator('[role="tree"]')).toBeVisible()
    await page.getByRole('button', { name: 'Conectar Claude Code' }).click()
    await page.getByRole('button', { name: 'Conectar', exact: true }).first().click()
    await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    const settings = JSON.parse(await readFile(path.join(userData, 'claude-settings.json'), 'utf8'))
    const command = settings.hooks.Stop[0].hooks[0].command as string
    const fire = (payload: Record<string, unknown>) =>
      execFileSync('/bin/sh', ['-c', command], { input: JSON.stringify({ cwd: ws, ...payload }) })
    const session = async (id: string, prompt: string, file: string) => {
      fire({ session_id: id, hook_event_name: 'UserPromptSubmit', prompt })
      await writeFile(path.join(ws, file), `editado por ${id}\n`)
      fire({
        session_id: id,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: path.join(ws, file) },
      })
      fire({ session_id: id, hook_event_name: 'SessionEnd' })
    }
    await session('sess-readme', 'Atualizar o README', 'README.md')
    await session('sess-app', 'Exportar o app', 'app.ts')

    await expect(page.locator('footer')).toContainText('● 2 para revisar')
    await page.locator('footer').getByRole('button', { name: '● 2 para revisar' }).click()
    const review = page.getByRole('region', { name: 'Para revisar' })
    const row = (name: string) => review.getByLabel(`Tarefa ${name}`)
    await expect(row('Atualizar o README')).toBeVisible()

    // Revisar abre o diff do que a sessão editou e ainda não foi commitado.
    await row('Atualizar o README').getByRole('button', { name: 'Revisar' }).click()
    await expect(page.getByText('Editados pelo agente e ainda não commitados')).toBeVisible()
    const files = page.getByRole('list', { name: 'Arquivos alterados' })
    await expect(files).toContainText('README.md')
    await expect(files).not.toContainText('app.ts')
    await expect(
      page.locator('.monaco-diff-editor:visible .modified-in-monaco-diff-editor'),
    ).toContainText('editado por sess-readme')

    // Commitar fora do Kite tira a sessão da lista (confere ao voltar para a janela).
    git(ws, 'commit', '-q', '-m', 'readme', '--', 'README.md')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.locator('footer')).toContainText('● 1 para revisar')

    // Dispensar tira a outra, e continua dispensada ao reabrir o Kite.
    await page.locator('footer').getByRole('button', { name: '● 1 para revisar' }).click()
    await row('Exportar o app').getByRole('button', { name: 'Dispensar Exportar o app' }).click()
    await expect(page.locator('footer')).not.toContainText('para revisar')
    await closeWindow(ctx.app)
    ctx = await launch(ws, { userData })
    // Com o Claude Code conectado, o Kite abre na Central; as sessões carregam logo depois.
    await expect(ctx.page.getByRole('button', { name: '+ Nova' })).toBeVisible()
    await ctx.page.waitForTimeout(2000)
    await expect(ctx.page.locator('footer')).not.toContainText('para revisar')
  } finally {
    await closeWindow(ctx.app).catch(() => {})
  }
})
